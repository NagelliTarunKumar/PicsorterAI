import os
import sys
import json
import tempfile
import requests
from google.cloud import storage
from scipy.spatial.distance import cosine
from face_recognition import load_image_file, face_encodings, face_locations
from PIL import Image
import numpy as np
import urllib.request  # For downloading input image

# Ensure Google Cloud credentials are set
os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = "/app/vision-api-key.json"

# Initialize Storage client
storage_client = storage.Client()

# Logging configuration
LOG_ENDPOINT = "http://127.0.0.1:3001/capture-logs"

def send_log(level, message, meta=None):
    """Sends a log message to the Node.js logging endpoint."""
    log_data = {
        "level": level,
        "message": message,
        "meta": meta or {}
    }
    try:
        response = requests.post(LOG_ENDPOINT, json=log_data)
        if response.status_code != 200:
            print(f"Failed to send log: {response.text}", file=sys.stderr)
    except Exception as e:
        print(f"Error while sending log: {str(e)}", file=sys.stderr)

def download_image_from_url(url, destination_path):
    """Downloads an image from a given URL."""
    try:
        urllib.request.urlretrieve(url, destination_path)
        send_log("info", f"[Backend-Python] Downloaded input image from URL to {destination_path}")
    except Exception as e:
        send_log("error", "[Backend-Python] Failed to download image from URL", {"error": str(e)})
        sys.exit(1)

def detect_faces_and_embeddings(image_path):
    """Detects faces and computes embeddings."""
    try:
        image = Image.open(image_path)
        if image.mode != "RGB":
            image = image.convert("RGB")
        image_array = np.array(image)
        locations = face_locations(image_array)
        embeddings = face_encodings(image_array, locations)
        send_log("info", f"[Backend-Python] Detected {len(locations)} face(s) in the image.")
        return locations, embeddings
    except Exception as e:
        send_log("error", "[Backend-Python] Error during face detection and embedding computation", {"error": str(e)})
        raise

def match_face_in_bucket(target_embedding, bucket_name, uploaded_image_name, threshold=0.91):
    """Matches the given face embedding against images in the bucket, excluding the uploaded image."""
    matching_faces = []
    try:
        blobs = list(storage_client.list_blobs(bucket_name))
        for blob in blobs:
            if blob.name.lower().endswith((".png", ".jpg", ".jpeg")) and blob.name != uploaded_image_name:
                with tempfile.NamedTemporaryFile(delete=False) as temp_file:
                    temp_file_path = temp_file.name
                    blob.download_to_filename(temp_file_path)

                    try:
                        _, embeddings_in_image = detect_faces_and_embeddings(temp_file_path)
                        for embedding in embeddings_in_image:
                            similarity = 1 - cosine(target_embedding, embedding)
                            if similarity >= threshold:
                                matching_faces.append(blob.name)
                                break
                    except Exception as e:
                        send_log("error", f"[Backend-Python] Error processing {blob.name}", {"error": str(e)})
                    finally:
                        os.remove(temp_file_path)
        send_log("info", f"[Backend-Python] Matching faces found: {len(matching_faces)}")
    except Exception as e:
        send_log("error", "[Backend-Python] Error during face matching in bucket", {"error": str(e)})
        raise
    return matching_faces

def main():
    if len(sys.argv) < 3:
        send_log("error", "[Backend-Python] Invalid arguments. Usage: python3 facedetection.py <image_url> <bucket_name>")
        print(json.dumps({"error": "[Backend-Python] Invalid arguments. Usage: python3 facedetection.py <image_url> <bucket_name>"}))
        sys.exit(1)

    image_url = sys.argv[1]
    bucket_name = sys.argv[2]
    uploaded_image_name = image_url.split("/")[-1]  # Extract image name from URL

    with tempfile.NamedTemporaryFile(delete=False, suffix=".jpg") as temp_image:
        temp_image_path = temp_image.name
        download_image_from_url(image_url, temp_image_path)

        try:
            locations, embeddings = detect_faces_and_embeddings(temp_image_path)
            if not embeddings:
                send_log("warning", "[Backend-Python] No face detected in the input image.")
                print(json.dumps({"error": "[Backend-Python] No face detected in the input image"}))
                sys.exit(1)

            target_embedding = embeddings[0]
            matching_faces = match_face_in_bucket(target_embedding, bucket_name, uploaded_image_name)
            send_log("info", "[Backend-Python] Face matching completed successfully.")
            print(json.dumps({"matching_faces": matching_faces}))
        finally:
            os.remove(temp_image_path)
            send_log("info", f"[Backend-Python] Temporary image file {temp_image_path} deleted.")

if __name__ == "__main__":
    main()
