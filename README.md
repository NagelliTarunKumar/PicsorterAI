# AI Photo Management System (Pic Sorter AI)

Face Recognition and Matching System is a web application designed to streamline the process of organizing and retrieving photos using advanced AI techniques. Users can upload photos to identify faces and find matching images from their gallery. The application uses a combination of powerful tools and frameworks for efficient image processing and data management.

![ Design](backend/design.png)

## Team Members:
- Tarun Kumar Nagelli
- Venkateshwarlu Mopidevi

## Table of Contents
1. Requirements
2. Installation
3. Working
4. Usage
5. Learnings

## Requirements
Ensure the following dependencies are installed:

- `google-cloud==0.34.0`
- `google-cloud-storage==2.8.0`
- `scipy==1.11.3`
- `face_recognition==1.3.0`
- `numpy==1.24.3`
- `requests==2.31.0`

## Installation
To install required libraries:

```bash
pip install -r requirements.txt
```

## Working
The project consists of several interconnected components that handle image uploading, processing, and result display.

### 1. **Frontend**
- Built with React.js, it provides an interactive interface for uploading and browsing images.
- Pulls images from the `get-images` API connected to Google Cloud Storage.
- Displays recent uploads in a dropdown menu for easy access.

### 2. **Backend**
- Developed with Flask and Node.js to handle requests and responses between components.
- Stores uploaded images in Redis as a cache and logs metadata (filename, upload time, status).

### 3. **Face Detection and Matching**
- Uses Google Vision API to detect the number of faces in an uploaded image.
  - If no or multiple faces are detected, an error is returned.
  - If one face is detected, the image is processed by OpenCV for face matching.
- OpenCV identifies similar faces in the gallery and sends results to the frontend.

### 4. **Storage and Caching**
- **Redis:** Maintains a cache of the five most recent uploads for quick access.
- **Google Cloud Storage:** Securely stores all images uploaded by users.

### 5. **Deployment**
- Utilizes Docker and Kubernetes for containerized deployment, ensuring consistency and scalability across all components.

## Usage
Follow the steps below to run the application:

### 1. **Create Docker images and starts the services:**

- Using Docker:
  ```bash
  docker-compose up --build
  ```

### 2. **Using Kubernetes:**

- Deploy Redis:
  ```bash
  kubectl apply -f redis-deployment.yaml
  ```

- Deploy Python Service:
  ```bash
  kubectl apply -f python-deployment.yaml
  ```
- Deploy Backend:
  ```bash
  kubectl apply -f backend-deployment.yaml
  ```
- Deploy Frontend:
  ```bash
  kubectl apply -f frontend-deployment.yaml
  ```

### 3. **Access the Application:**

- Open your browser and go to [http://localhost:3000](http://localhost:3000) (or the Kubernetes-assigned port).

### 4. **Upload and Process Images:**

- Click on **"Choose File"** to upload an image.
- Click **"Upload"** to process the image and view results.
- Use the dropdown menu to select from recent uploads.

### 5. **View Results:**

- Processed images and matching results are displayed on the web interface.

## Learnings

1. Gained hands-on experience with deploying microservices using Docker and Kubernetes.
2. Enhanced understanding of integrating APIs, such as Google Vision API and OpenCV.
3. Improved skills in designing scalable and interactive web applications.
4. Learned to optimize image storage and retrieval using Redis.
5. Mastered implementing face recognition and matching techniques using AI models.

## Thank You
We express our heartfelt gratitude to everyone who guided and supported us throughout the development of the Face Recognition and Matching System. Your contributions have been invaluable in making this project a success.

