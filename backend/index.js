const express = require("express");
const { Storage } = require("@google-cloud/storage");
const cors = require("cors");
const multer = require("multer");
const { spawn } = require("child_process");
const vision = require("@google-cloud/vision");
const redis = require("ioredis");
const winston = require("winston");
const path = require("path");
const moment = require("moment-timezone");

const app = express();

// Redis client setup
const redisClient = new redis({
  host: process.env.REDIS_HOST || "localhost",
  port: 6379,
  db: 0,
});

// Google Cloud Storage setup
const storage = new Storage({
  keyFilename: "/app/vision-api-key.json",
});
const bucketName = "photomanagement_ai_photos";

// Google Vision API client
const visionClient = new vision.ImageAnnotatorClient({
  keyFilename: "/app/vision-api-key.json",
});

// Enable CORS
app.use(cors());

app.use(express.json()); // This will ensure JSON data is parsed

app.use(express.urlencoded({ extended: true })); // Parse URL-encoded data

// Multer setup for file uploads
const upload = multer({ storage: multer.memoryStorage() });

// Redis image queue name
const IMAGE_QUEUE = "imageQueue";
const MAX_IMAGES = 5;

// Logger setup
const logsDir = path.join(__dirname, "..", "logs");
const logger = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    winston.format.printf(({ timestamp, level, message }) => {
      return `[${timestamp}] ${level.toUpperCase()}: ${message}`;
    })
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({
      filename: path.join(logsDir, `${moment().tz("MST").format("YYYY-MM-DD")}.log`),
      level: "info",
    }),
  ],
});

//Endpoint to cpature logs from frontend
app.post("/capture-logs", (req, res) => {
  const { level, message, meta } = req.body;

  if (!level || !message) {
    return res.status(400).json({ message: "Log level and message are required" });
  }

    // Debug log to ensure the log is received
    console.log('Received log:', { level, message, meta });

  // Use Winston to log the message
  logger.log(level, message, meta || {});
  res.status(200).json({ message: "Log received successfully" });
});


// **Endpoint to fetch image URLs from the bucket**
app.get("/images", async (req, res) => {
  try {
    const [files] = await storage.bucket(bucketName).getFiles();
    const imageUrls = files.map(
      (file) => `https://storage.googleapis.com/${bucketName}/${file.name}`
    );
    logger.info("[Backend-Node] Fetched image URLs from bucket successfully.");
    res.json(imageUrls);
  } catch (error) {
    logger.error(`[Backend-Node] Error fetching files: ${error.message}`);
    res.status(500).send("Error fetching files from Google Cloud Storage");
  }
});

// **Endpoint to fetch recently uploaded images from Redis**
app.get("/recent-images", async (req, res) => {
  try {
    const imageNames = await redisClient.lrange(IMAGE_QUEUE, 0, MAX_IMAGES - 1);

    const images = [];
    for (const imageName of imageNames) {
      const imageBuffer = await redisClient.getBuffer(imageName);
      if (imageBuffer) {
        const imageUrl = `http://127.0.0.1:3001/image/${imageName}`;
        images.push({
          imageName,
          imageUrl,
        });
      }
    }

    logger.info("[Backend-Node] Fetched recent images from Redis successfully.");
    res.json({
      message: "Successfully fetched recent images",
      status: "success",
      images,
    });
  } catch (error) {
    logger.error(`[Backend-Node] Error fetching recent images from Redis: ${error.message}`);
    res.status(500).json({ message: "Error fetching recent images", error: error.message });
  }
});

// **Endpoint to fetch image stored in Redis**
app.get("/image/:imageName", async (req, res) => {
  const imageName = req.params.imageName;

  try {
    const imageBuffer = await redisClient.getBuffer(imageName);
    if (!imageBuffer) {
      logger.warn(`[Backend-Node] Image not found in Redis: ${imageName}`);
      return res.status(404).json({ message: "Image not found in Redis" });
    }

    logger.info(`[Backend-Node] Fetched image ${imageName} from Redis successfully.`);
    res.set("Content-Type", "image/jpeg");
    res.send(imageBuffer);
  } catch (error) {
    logger.error(`[Backend-Node] Error fetching image from Redis: ${error.message}`);
    res.status(500).json({ message: "Error fetching image from Redis" });
  }
});

// **Endpoint to detect faces in uploaded images**
app.post("/detect-face", upload.single("image"), async (req, res) => {
  try {
    let imageBuffer, imageName;

    if (req.file) {
      imageBuffer = req.file.buffer;
      imageName = `image_${Date.now()}`;
      await redisClient.set(imageName, imageBuffer);
      await redisClient.lpush(IMAGE_QUEUE, imageName);
    } else if (req.query.imageName) {
      imageName = req.query.imageName;
      imageBuffer = await redisClient.getBuffer(imageName);
      if (!imageBuffer) {
        logger.warn(`[Backend-Node] Image not found in Redis for face detection: ${imageName}`);
        return res.status(404).json({ message: "Image not found in Redis" });
      }
    } else {
      logger.warn("[Backend-Node] No file or image selected for face detection.");
      return res.status(400).json({ message: "No file or image selected" });
    }

    const queueLength = await redisClient.llen(IMAGE_QUEUE);
    if (queueLength > MAX_IMAGES) {
      const oldestImage = await redisClient.rpop(IMAGE_QUEUE);
      if (oldestImage) {
        await redisClient.del(oldestImage);
        logger.info(`[Backend-Node] Removed oldest image from Redis: ${oldestImage}`);
      }
    }

    const [result] = await visionClient.faceDetection({ image: { content: imageBuffer } });
    const faces = result.faceAnnotations;

    const publicTempUrl = `http://127.0.0.1:3001/image/${imageName}`;

    if (faces.length === 1) {
      const bucket = storage.bucket(bucketName);
      const file = bucket.file(imageName);
      await file.save(imageBuffer);
      const publicUrl = `https://storage.googleapis.com/${bucketName}/${imageName}`;
      logger.info(`[Backend-Node] Uploaded image to Google Cloud Storage: ${publicUrl}`);

      const pythonScriptPath = "/app/source_code/facedetection.py";
      const pythonProcess = spawn("/usr/bin/python3", [pythonScriptPath, publicUrl, bucketName]);

      let stdout = "";
      let stderr = "";

      pythonProcess.stdout.on("data", (data) => {
        stdout += data.toString();
      });

      pythonProcess.stderr.on("data", (data) => {
        stderr += data.toString();
      });

      pythonProcess.on("close", async (code) => {
        try {
          await file.delete();
          logger.info(`[Backend-Node] Deleted uploaded image: ${imageName}`);
        } catch (deleteError) {
          logger.error(`[Backend-Node] Error deleting uploaded image: ${deleteError.message}`);
        }

        if (code === 0) {
          try {
            const result = JSON.parse(stdout);
            logger.info("[Backend-Node] Face detection and matching completed successfully.");
            res.json({
              message: "Face detection successful.",
              status: "success",
              matchingImages: result.matching_faces.map(
                (name) => `https://storage.googleapis.com/${bucketName}/${name}`
              ),
              uploadedImageUrl: publicTempUrl,
            });
          } catch (parseError) {
            logger.error(`[Backend-Node] Error parsing Python script output: ${parseError.message}`);
            res.status(500).json({ message: "Failed to process script output." });
          }
        } else {
          logger.error(`[Backend-Node] Python script error: ${stderr}`);
          res.status(500).json({ message: "Error processing face matching", error: stderr });
        }
      });
    } else {
      logger.warn(
        faces.length > 1
          ? "[Backend-Node] Multiple faces detected in the image."
          : "[Backend-Node] No face detected in the image."
      );
      res.json({
        message: faces.length > 1 ? "Multiple faces detected" : "No face detected",
        status: "failure",
        uploadedImageUrl: publicTempUrl,
        matchingImages: [],
      });
    }
  } catch (error) {
    logger.error(`[Backend-Node] Error detecting faces: ${error.message}`);
    res.status(500).json({ message: "Error processing image", error: error.message });
  }
});

// **Start the server**
const PORT = process.env.PORT || 3001;
app.listen(PORT, "0.0.0.0", () => {
  logger.info(`[Backend-Node] Server running on port ${PORT}`);
});
