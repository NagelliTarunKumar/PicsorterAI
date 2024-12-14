import React, { useEffect, useState } from "react";
import axios from "axios";
import "./App.css";
import logger from "../logger";

const PhotoGrid = ({ matchedImages, showMatched, uploadedPhoto }) => {
  const [allPhotos, setAllPhotos] = useState([]);

  useEffect(() => {
    const fetchPhotos = async () => {
      try {
        logger.info("[Frontend] Fetching photos from the backend...");
        const response = await axios.get("http://127.0.0.1:3001/images");
        setAllPhotos(response.data);
        logger.info("[Frontend] Fetched photos successfully", { data: response.data });
      } catch (error) {
        logger.error("[Frontend] Error fetching photos", { error: error.message });
      }
    };

    fetchPhotos();
  }, []);

  const photosToDisplay = showMatched ? matchedImages : allPhotos;

  return (
    <div className="photo-grid-container">
      {uploadedPhoto && (
        <div className="uploaded-photo-container">
          <h3>Uploaded Photo:</h3>
          <img src={uploadedPhoto} alt="Uploaded" className="uploaded-photo" />
        </div>
      )}

      <div className="photo-grid">
        {photosToDisplay.length > 0 ? (
          photosToDisplay.map((photo, index) => (
            <div key={index} className="photo-item">
              <img
                src={photo}
                alt={`photo-${index}`}
                style={{ width: "200px", height: "200px", objectFit: "cover" }}
              />
            </div>
          ))
        ) : (
          <p>No photos available</p>
        )}
      </div>
    </div>
  );
};

export default PhotoGrid;
