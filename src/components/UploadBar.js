import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import logger from "../logger"; // Import logger utility
import "./App.css";

const UploadBar = ({ setMatchedImages, setShowMatched, setUploadedPhoto }) => {
  const [file, setFile] = useState(null);
  const [message, setMessage] = useState("");
  const [messageColor, setMessageColor] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [recentImages, setRecentImages] = useState([]); // State for Redis images
  const [selectedRedisImage, setSelectedRedisImage] = useState(""); // State for dropdown selection
  const [dropdownOpen, setDropdownOpen] = useState(false); // Track dropdown visibility

  // Fetch recent images from Redis on mount and whenever Redis is updated
  const fetchRecentImages = async () => {
    try {
      logger.info("[Frontend] Fetching recent images from Redis...");
      const response = await axios.get("http://127.0.0.1:3001/recent-images");
      setRecentImages(response.data.images || []);
      logger.info("[Frontend] Recent images fetched successfully", { images: response.data.images });
    } catch (error) {
      logger.error("[Frontend] Error fetching recent images from Redis", { error: error.message });
    }
  };

  useEffect(() => {
    fetchRecentImages();
  }, []);

  // Memoize the processRedisImage function to avoid unnecessary re-creations
  const processRedisImage = useCallback(async (imageName) => {
    setIsLoading(true);
    setMessage("");
    setMessageColor("");
    logger.info("[Frontend] Processing Redis image", { imageName });

    try {
      const response = await axios.post("http://127.0.0.1:3001/detect-face", null, {
        params: { imageName },
      });

      const { message, status, matchingImages, uploadedImageUrl } = response.data;
      logger.info("[Frontend] Redis image processed successfully", {
        imageName,
        message,
        status,
        matchingImages,
      });

      setMessage(message);
      setMessageColor(status === "success" ? "green" : "red");

      if (status === "success" || status === "failure") {
        setMatchedImages(matchingImages); // Pass matched images to parent state
        setUploadedPhoto(uploadedImageUrl); // Set uploaded photo URL
        setShowMatched(true); // Indicate matched images should be shown
      } else {
        setShowMatched(false); // Fall back to showing all photos
      }
    } catch (error) {
      logger.error("[Frontend] Error processing Redis image", { error: error.message });
      setMessage("Failed to process the image.");
      setMessageColor("red");
    } finally {
      setIsLoading(false);
    }
  }, [setMatchedImages, setShowMatched, setUploadedPhoto]);  // Add other props if needed

  // Trigger handleUpload when an image is selected from the dropdown
  useEffect(() => {
    if (selectedRedisImage) {
      logger.info("[Frontend] Redis image selected", { imageName: selectedRedisImage });
      processRedisImage(selectedRedisImage);
    }
  }, [selectedRedisImage, processRedisImage]);  // `processRedisImage` is stable now

  const handleUpload = async () => {
    if (!file && !selectedRedisImage) {
      setMessage("Please select a file to upload or an image from the dropdown.");
      setMessageColor("red");
      logger.warn("[Frontend] No file or Redis image selected for upload");
      return;
    }

    setIsLoading(true);
    logger.info("[Frontend] Starting file upload", { file: file?.name });

    try {
      if (file) {
        // Handle direct file upload
        const formData = new FormData();
        formData.append("image", file);
        const response = await axios.post("http://127.0.0.1:3001/detect-face", formData);

        const { message, status, matchingImages, uploadedImageUrl } = response.data;
        logger.info("[Frontend] File uploaded successfully", {
          file: file.name,
          message,
          status,
          matchingImages,
        });

        setMessage(message);
        setMessageColor(status === "success" ? "green" : "red");

        if (status === "success" || status === "failure") {
          setMatchedImages(matchingImages); // Pass matched images to parent state
          setUploadedPhoto(uploadedImageUrl); // Set uploaded photo URL
          setShowMatched(true); // Indicate matched images should be shown
        } else {
          setShowMatched(false); // Fall back to showing all photos
        }

        setFile(null);
        fetchRecentImages(); // Refresh the dropdown
      }
    } catch (error) {
      logger.error("[Frontend] Error uploading file or detecting face", { error: error.message });
      setMessage("Failed to process the file.");
      setMessageColor("red");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="upload-container">
      <div className="instruction-container">
        <p>Upload an image of yours or select a recent image to find matching faces.</p>
      </div>

      <div className="upload-bar">
        <input
          type="file"
          accept="image/*"
          onChange={(e) => {
            setFile(e.target.files[0]);
            setSelectedRedisImage(""); // Clear dropdown selection
            logger.info("[Frontend] File selected for upload", { fileName: e.target.files[0]?.name });
          }}
        />
        <button onClick={handleUpload} disabled={isLoading}>
          {isLoading ? "Uploading..." : "Upload Image"}
        </button>
      </div>

      {/* Custom Dropdown */}
      <div className="dropdown-container">
        <label htmlFor="recent-images">Or select a recent image: </label>
        <div
          className="custom-dropdown"
          onClick={() => setDropdownOpen(!dropdownOpen)}
        >
          <span>{selectedRedisImage ? selectedRedisImage : "Select an image"}</span>
          <div className={`dropdown-menu ${dropdownOpen ? "open" : ""}`}>
            {recentImages.map((image, index) => (
              <div
                key={index}
                className="dropdown-item"
                onClick={() => {
                  setSelectedRedisImage(image.imageName);
                  setDropdownOpen(false);
                  setFile(null); // Clear file selection
                  logger.info("[Frontend] Image selected from dropdown", { imageName: image.imageName });
                }}
              >
                <img
                  src={image.imageUrl}
                  alt={image.imageName}
                  className="dropdown-image"
                />
                <span>{image.imageName}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="message-container">
        {message && <p style={{ color: messageColor }}>{message}</p>}
      </div>
    </div>
  );
};

export default UploadBar;
