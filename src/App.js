import React, { useState } from "react";
import UploadBar from "./components/UploadBar";
import PhotoGrid from "./components/PhotoGrid";

function App() {
  const [matchedImages, setMatchedImages] = useState([]);
  const [showMatched, setShowMatched] = useState(false);
  const [uploadedPhoto, setUploadedPhoto] = useState(null); // New state for uploaded photo

  return (
    <div>
      <h1 style={{ textAlign: "center", margin: "20px 0" }}>
        AI Photo Management System
      </h1>
      <UploadBar
        setMatchedImages={setMatchedImages}
        setShowMatched={setShowMatched}
        setUploadedPhoto={setUploadedPhoto}
      />
      <PhotoGrid
        matchedImages={matchedImages}
        showMatched={showMatched}
        uploadedPhoto={uploadedPhoto}
      />
    </div>
  );
}

export default App;
