export async function openCamera(
  video: HTMLVideoElement,
  width = 640,
  height = 480,
  exactRes = false,
): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("Camera requires HTTPS. Open this page via https://");
  }
  const resConstraint = exactRes
    ? { width: { exact: width }, height: { exact: height } }
    : { width: { ideal: width }, height: { ideal: height } };
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { ...resConstraint, facingMode: "user" },
  });
  video.srcObject = stream;
  await video.play();
  if (video.videoWidth === 0) {
    await new Promise<void>((resolve) =>
      video.addEventListener("loadedmetadata", () => resolve(), { once: true }),
    );
  }
  return stream;
}
