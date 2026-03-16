# ARGUS Deepfake Detection Backend

This folder contains the Python backend for the ARGUS Deepfake Detection system. It exposes a local API that the browser extension uses to analyze video frames in real-time.

It features a combined ML pipeline:
1. **Face Detection** (MTCNN)
2. **Deepfake Face Classifier** (EfficientNet-B0 trained on deepfakes)
3. **Frame-level Forensics** (Detects frequency artifacts, noise anomalies, and Error Level Analysis)
4. **Temporal Consistency Tracking** (Voting across consecutive frames for stable predictions)

## Setup Instructions

To run the backend on a new machine (like a friend's PC), follow these steps:

### 1. Prerequisites
- Python 3.9 or newer
- (Optional but recommended) NVIDIA GPU with CUDA for faster real-time detection

### 2. Create a Virtual Environment
It's highly recommended to use a virtual environment so you don't mess up your system Python packages.

**On Windows:**
```powershell
python -m venv venv
.\venv\Scripts\activate
```

**On macOS/Linux:**
```bash
python3 -m venv venv
source venv/bin/activate
```

### 3. Install Dependencies
Make sure you are in the `argus/backend/` directory and your virtual environment is activated, then run:

```bash
pip install -r backend/requirements.txt
```

*(Note: The `requirements.txt` includes heavy packages like `torch`, `torchvision`, `opencv-python`, config-related libraries, etc. This may take a few minutes).*

### 4. Model Weights
The pre-trained model file `best_model.pth` (approx. 19MB) is included in `backend/weights/`.

### 5. Start the Server
Once everything is installed, start the local Flask server:

```bash
cd backend
python server.py
```

You should see an output indicating the models are loaded and the server is running on `http://localhost:5000`.

---

## How it works

Once `backend_server.py` is running, it listens on port `5000`. 
The ARGUS browser extension (in the `extension/` folder) automatically captures video frames from a webpage and POSTs them to `http://localhost:5000/analyze`.

### Manual API Testing
If you want to test the prediction API manually without the browser extension, you can send an image directly:

```bash
curl -X POST -F "frame=@path_to_your_image.jpg" http://localhost:5000/analyze
```

The response will be a JSON object containing the `fake_probability`, verdict, and breakdown of the analysis.
