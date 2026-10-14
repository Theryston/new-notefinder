// Runs on the audio thread: hands the mic's samples to the page in blocks.
// It is a plain file because an AudioWorklet module is loaded by URL.
class PitchCaptureProcessor extends AudioWorkletProcessor {
  process(inputs) {
    const channel = inputs[0]?.[0];
    if (channel) this.port.postMessage(channel.slice());
    return true;
  }
}

registerProcessor('pitch-capture', PitchCaptureProcessor);
