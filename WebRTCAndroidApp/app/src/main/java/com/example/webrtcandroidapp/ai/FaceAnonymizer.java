package com.example.webrtcandroidapp.ai;

import android.content.Context;
import android.graphics.Bitmap;
import android.renderscript.Allocation;
import android.renderscript.Element;
import android.renderscript.RenderScript;
import android.renderscript.ScriptIntrinsicYuvToRGB;
import android.util.Log;

import com.google.common.collect.ImmutableList;
import com.google.mediapipe.formats.proto.DetectionProto;
import com.google.mediapipe.formats.proto.LocationDataProto;
import com.google.mediapipe.solutions.facedetection.FaceDetection;
import com.google.mediapipe.solutions.facedetection.FaceDetectionOptions;
import com.google.mediapipe.solutions.facedetection.FaceDetectionResult;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

public class FaceAnonymizer {

    private static final String TAG = "FaceAnonymizer";

    private static final float FD_OVERLAY_COMPENSATION_FACTOR = 0.1F;
    private static final float ALLOWED_OFFSET = 0.05F;
    private static final int PROCESSING_INTERVAL = 200;
    private static final int DETECTION_REMOVAL_DELAY = 1000;
    private static final float NV21_OFFSET_FACTOR = 1.5F;
    private static final int MAX_PIXELATION_SEGMENT_CUBE_COUNT = 50;
    private static final int DEFAULT_PIXELATION_ROW_CUBE_COUNT = 80;
    private static final int DEFAULT_PIXEL_Y_VALUE = 90;
    private static final int DEFAULT_PIXEL_UV_VALUE = 128;

    private final Object mStateLock = new Object();
    private final Context mContext;

    private FaceDetection mFaceDetection;
    private List<FDBoundingBox> mBoundingBoxes;
    private RenderScript mRenderScript;
    private ScriptIntrinsicYuvToRGB mYuvToRgbIntrinsic;
    private Allocation mAllocationIn;
    private Bitmap mBitmapOut;
    private Allocation mAllocationOut;
    private NotifyingThread mFaceDetectionThread;

    private int mCalculatedWidth;
    private int mCalculatedHeight;

    private boolean mFaceDetectionThreadAlive = false;
    private boolean mHasUnconfirmedDetections = false;

    public FaceAnonymizer(Context context) {
        mContext = context;
        setupFaceDetection();
    }

    public void setupBitmapUtils(int width, int height) {
        Log.d(TAG, "setupBitmapUtils");

        if (width > 0 && height > 0) {
            if (mCalculatedWidth != width && mCalculatedHeight != height) {
                mCalculatedWidth = width;
                mCalculatedHeight = height;

                dispose();

                mRenderScript = RenderScript.create(mContext);
                mYuvToRgbIntrinsic = ScriptIntrinsicYuvToRGB.create(mRenderScript, Element.U8_4(mRenderScript));
                int yuvDataLength = width * height * 3 / 2;
                mAllocationIn = Allocation.createSized(mRenderScript, Element.U8(mRenderScript), yuvDataLength);
                mBitmapOut = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888);
                mAllocationOut = Allocation.createFromBitmap(mRenderScript, mBitmapOut);
                mYuvToRgbIntrinsic.setInput(mAllocationIn);

                Log.d(TAG, "setupBitmapUtils: Done.");
            }
        } else {
            Log.w(TAG, "setupBitmapUtils: Skipping - invalid width or height.");
        }
    }

    public void removeFacesFromNV21(byte[] nv21, int ySize) {
        synchronized (mStateLock) {
            if (mBoundingBoxes != null && mBoundingBoxes.size() > 0) {
                for (FDBoundingBox boundingBox : mBoundingBoxes) {
                    if (boundingBox.isConfirmed()) {
                        int previewHeight = mCalculatedHeight;
                        int previewWidth = mCalculatedWidth;

                        int boxWidth = (int) (previewWidth * boundingBox.getWidth());
                        int boxHeight = (int) (previewHeight * boundingBox.getHeight());
                        int left = fixPosition((int) (previewWidth * boundingBox.getXMin()));
                        int top = fixPosition((int) (previewHeight * (boundingBox.getYMin())));

                        if (FD_OVERLAY_COMPENSATION_FACTOR > 0) {
                            int compensation = (int) (Math.min(boxHeight, boxWidth) * FD_OVERLAY_COMPENSATION_FACTOR);
                            boxWidth += compensation * 2;
                            boxHeight += compensation * 2;
                            left -= compensation;
                            top -= compensation;
                        }

                        applyAnonymization(nv21, ySize, top, left, boxHeight, boxWidth, previewWidth);
                    }
                }
            }
        }
    }

    public void analyzeImage(byte[] nv21Original) {
        if (mFaceDetectionThread == null || !mFaceDetectionThreadAlive) {
            mFaceDetectionThread = new NotifyingThread() {
                @Override
                public void doRun() {
                    try {
                        mAllocationIn.copyFrom(nv21Original);
                        mYuvToRgbIntrinsic.forEach(mAllocationOut);
                        mAllocationOut.copyTo(mBitmapOut);
                    } catch (Exception ex) {
                        return;
                    }

                    if (mBitmapOut != null) {
                        Bitmap fixedBitmap = mBitmapOut;
                        mFaceDetection.send(fixedBitmap, System.currentTimeMillis());
                    }
                }
            };
            mFaceDetectionThread.addListener(() -> mFaceDetectionThreadAlive = false);
            mFaceDetectionThreadAlive = true;
            mFaceDetectionThread.start();
        }
    }

    public void dispose() {
        Log.d(TAG, "dispose");

        try {
            if (mAllocationIn != null) {
                mAllocationIn.destroy();
            }
            if (mAllocationOut != null) {
                mAllocationOut.destroy();
            }
            if (mRenderScript != null) {
                mRenderScript.destroy();
            }
            if (mYuvToRgbIntrinsic != null) {
                mYuvToRgbIntrinsic.destroy();
            }
            if (mBitmapOut != null) {
                mBitmapOut.recycle();
                mBitmapOut = null;
            }
        } catch (Exception e) {
            Log.e(TAG, "dispose: Failed.", e);
        }
    }

    public boolean hasUnconfirmedDetections() {
        return mHasUnconfirmedDetections;
    }

    private void applyAnonymization(byte[] nv21, int uvOffset, int top, int left, int boxHeight, int boxWidth, int previewWidth) {
        int totalLength = (int) (NV21_OFFSET_FACTOR * uvOffset);
        applyAnonymizationOnArea(nv21, previewWidth, top, left, boxWidth, boxHeight, uvOffset, totalLength);
    }

    private void applyAnonymizationOnArea(byte[] nv21, int previewWidth, int top, int left, int width, int height, int uvOffset, int totalLength) {
        int uvHeight = (int) Math.floor(height / 2.0);
        int minPixelationBoxSize = previewWidth / DEFAULT_PIXELATION_ROW_CUBE_COUNT;
        int segmentPixelationBoxSize = width / MAX_PIXELATION_SEGMENT_CUBE_COUNT;
        int pixelationBoxSize = Math.max(minPixelationBoxSize, segmentPixelationBoxSize);

        Map<Integer, Byte> replacementPixelMap = new HashMap<>();
        int keyOffset = Math.max(height, width);

        for (int w = 0; w < height; w++) {
            int imgPos = (top + w) * previewWidth + left;
            for (int h = 0; h < width; h++) {
                int yPosition = h + imgPos;
                if (yPosition >= 0 && yPosition <= uvOffset) {
                    int key = (h - h % pixelationBoxSize) * keyOffset + (w - w % pixelationBoxSize);
                    if (h % pixelationBoxSize == 0 && w % pixelationBoxSize == 0) {
                        replacementPixelMap.put(key, nv21[yPosition]);
                    } else {
                        Byte replacementPixelY = replacementPixelMap.get(key);
                        nv21[yPosition] = replacementPixelY != null ? replacementPixelY : (byte) DEFAULT_PIXEL_Y_VALUE;
                    }
                }
            }
        }
        replacementPixelMap.clear();
        for (int w = 0; w < uvHeight; w++) {
            int imgPos = uvOffset + (top / 2 + w) * previewWidth + left;
            for (int h = 0; h < width; h++) {
                int uvPosition = h + imgPos;
                if (uvPosition <= totalLength) {
                    int offset = h % 2;
                    int key = ((h - h % pixelationBoxSize) * keyOffset + (w - w % pixelationBoxSize)) + (offset * keyOffset * keyOffset);
                    if ((h - offset) % pixelationBoxSize == 0 && w % pixelationBoxSize == 0) {
                        replacementPixelMap.put(key, nv21[uvPosition]);
                    } else {
                        Byte replacementPixelUV = replacementPixelMap.get(key);
                        nv21[uvPosition] = replacementPixelUV != null ? replacementPixelUV : (byte) DEFAULT_PIXEL_UV_VALUE;
                    }
                }
            }
        }
        replacementPixelMap.clear();
    }

    private int fixPosition(int position) {
        if (position < 0) {
            position = 0;
        }
        if (position % 2 == 1) {
            position++;
        }
        return position;
    }

    private void setupFaceDetection() {
        Log.d(TAG, "setupFaceDetection");

        mFaceDetection = new FaceDetection(mContext,
                FaceDetectionOptions.builder().setStaticImageMode(false).setMinDetectionConfidence(1.0F).setModelSelection(0).build());
        mFaceDetection.setErrorListener(
                (message, e) -> {
                    Log.e(TAG, "setupFaceDetection: Failed.", e);
                });
        mFaceDetection.setResultListener(this::processFaceDetectionResult);
    }

    private void processFaceDetectionResult(FaceDetectionResult result) {
        long now = System.currentTimeMillis();
        ImmutableList<DetectionProto.Detection> faceDetections = result.multiFaceDetections();
        List<FDBoundingBox> existingBoundingBoxes = new ArrayList<>(mBoundingBoxes != null ? mBoundingBoxes : new ArrayList<>());
        if (existingBoundingBoxes.size() > 0) {
            existingBoundingBoxes = existingBoundingBoxes.stream()
                    .filter(ebb -> (now - ebb.getLastDetectionTime()) < DETECTION_REMOVAL_DELAY)
                    .collect(Collectors.toList());
        }

        synchronized (mStateLock) {
            List<FDBoundingBox> boundingBoxes = new ArrayList<>();
            mHasUnconfirmedDetections = false;
            if (faceDetections != null && faceDetections.size() > 0) {
                for (int detectionIndex = 0; detectionIndex < faceDetections.size(); detectionIndex++) {
                    DetectionProto.Detection detection = faceDetections.get(detectionIndex);
                    FDBoundingBox existingBoundingBox = getPrevBoundingBox(existingBoundingBoxes, detectionIndex, detection);
                    if (existingBoundingBox != null) {
                        existingBoundingBoxes.remove(existingBoundingBox);
                    }
                    if (existingBoundingBox != null && (now - existingBoundingBox.getLastDetectionTime() < PROCESSING_INTERVAL)) {
                        existingBoundingBox.confirm();
                        boundingBoxes.add(existingBoundingBox);
                    } else {
                        LocationDataProto.LocationData locationData = detection.getLocationData();
                        LocationDataProto.LocationData.RelativeBoundingBox boundingBox = locationData.getRelativeBoundingBox();
                        FDBoundingBox newBoundingBox = FDBoundingBox.fromBoundingBox(detectionIndex, boundingBox);
                        if (existingBoundingBox != null) {
                            newBoundingBox.confirm();
                        } else {
                            mHasUnconfirmedDetections = true;
                        }
                        boundingBoxes.add(newBoundingBox);
                    }
                }
                mBoundingBoxes = boundingBoxes;
            } else {
                mBoundingBoxes = new ArrayList<>();
            }
            if (existingBoundingBoxes.size() > 0) {
                existingBoundingBoxes = existingBoundingBoxes.stream().filter(FDBoundingBox::isConfirmed)
                        .collect(Collectors.toList());

                if (existingBoundingBoxes.size() > 0) {
                    mBoundingBoxes.addAll(existingBoundingBoxes);
                }
            }
        }
    }

    private FDBoundingBox getPrevBoundingBox(List<FDBoundingBox> boundingBoxes, int detectionIndex, DetectionProto.Detection detection) {
        FDBoundingBox expectedBoundingBox = boundingBoxes.size() > detectionIndex
                ? boundingBoxes.get(detectionIndex) : null;
        LocationDataProto.LocationData locationData = detection.getLocationData();
        LocationDataProto.LocationData.RelativeBoundingBox nbb = locationData.getRelativeBoundingBox();

        if (expectedBoundingBox == null || !areClose(expectedBoundingBox, nbb)) {
            expectedBoundingBox = boundingBoxes.stream()
                    .filter(bb -> areClose(bb, nbb)).findFirst().orElse(null);

        }
        return  expectedBoundingBox;
    }

    private boolean areClose(FDBoundingBox boundingBox1, LocationDataProto.LocationData.RelativeBoundingBox boundingBox2) {
        return Math.abs(boundingBox1.getXMin() - boundingBox2.getXmin()) < ALLOWED_OFFSET
                && Math.abs(boundingBox1.getYMin() - boundingBox2.getYmin()) < ALLOWED_OFFSET;
    }
}

class FDBoundingBox {
    private long fdId;
    private float xMin;
    private float yMin;
    private float width;
    private float height;
    private boolean confirmed;
    private long timeCreated;
    private long lastDetectionTime;

    public FDBoundingBox(long fdId, float xMin, float yMin, float width, float height) {
        this.fdId = fdId;
        this.xMin = xMin;
        this.yMin = yMin;
        this.width = width;
        this.height = height;
        this.timeCreated = System.currentTimeMillis();
        this.confirmed = false;
        this.lastDetectionTime = System.currentTimeMillis();
    }

    public float getYMin() {
        return yMin;
    }

    public float getXMin() {
        return xMin;
    }

    public float getWidth() {
        return width;
    }

    public float getHeight() {
        return height;
    }

    public boolean isConfirmed() {
        return confirmed;
    }

    public void confirm() {
        this.confirmed = true;
        this.lastDetectionTime = System.currentTimeMillis();
    }

    public long getLastDetectionTime() {
        return lastDetectionTime;
    }

    public static FDBoundingBox fromBoundingBox(long fdId, LocationDataProto.LocationData.RelativeBoundingBox boundingBox) {
        return new FDBoundingBox(fdId, boundingBox.getXmin(), boundingBox.getYmin(), boundingBox.getWidth(), boundingBox.getHeight());
    }
}

interface ExecutionListener {
    void onDone();
}

abstract class NotifyingThread extends Thread {

    private final List<ExecutionListener> mListeners = new ArrayList<>();

    public final void addListener(final ExecutionListener listener) {
        mListeners.add(listener);
    }

    public final void removeListener(final ExecutionListener listener) {
        mListeners.remove(listener);
    }

    private void notifyListeners() {
        for (ExecutionListener listener : mListeners) {
            listener.onDone();
        }
    }

    @Override
    public final void run() {
        try {
            doRun();
        } finally {
            notifyListeners();
        }
    }

    public abstract void doRun();
}
