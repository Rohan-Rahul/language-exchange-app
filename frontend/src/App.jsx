import { useEffect, useState, useRef } from "react";
import { io } from 'socket.io-client';
import Peer from 'simple-peer';
import muted from '../src/assets/mute.png';
import disableCamera from '../src/assets/disableCamera.png';

// Update this to your live backend URL before deploying
const URL = "https://language-exchange-app.onrender.com"; 

const socket = io(URL, {
  autoConnect: false 
});

function App() {
  const [isConnected, setIsConnected] = useState(socket.connected);
  const [stream, setStream] = useState(null);
  const [receivingCall, setReceivingCall] = useState(false);
  const [callerSignal, setCallerSignal] = useState();
  const [callAccepted, setCallAccepted] = useState(false);
  const [callEnded, setCallEnded] = useState(false);
  const [micActive, setMicActive] = useState(true);
  const [cameraActive, setCameraActive] = useState(true);

  const localVideo = useRef();
  const remoteVideo = useRef();
  const connectionRef = useRef();

  useEffect(() => {
    socket.connect();

    navigator.mediaDevices.getUserMedia({ video: true, audio: true }).then((mediaStream) => {
      setStream(mediaStream);
      if (localVideo.current) localVideo.current.srcObject = mediaStream;
    });

    socket.on("hey", (data) => {
      setReceivingCall(true);
      setCallerSignal(data.signal);
    });

    socket.on("callEnded", () => {
      setCallEnded(true);
      if (connectionRef.current) connectionRef.current.destroy();
      window.location.reload(); // Resets the UI for a new call
    });
  }, []);

  const callUser = () => {
    const peer = new Peer({
      initiator: true,
      trickle: false,
      stream: stream,
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'turn:openrelay.metered.ca:80', username: 'openrelayproject', credential: 'openrelayproject' },
          { urls: 'turn:openrelay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject' }
        ]
      }
    });

    peer.on("signal", (data) => {
      socket.emit("callUser", { signalData: data });
    });

    peer.on("stream", (remoteStream) => {
      if (remoteVideo.current) remoteVideo.current.srcObject = remoteStream;
    });

    socket.on("callAccepted", (signal) => {
      setCallAccepted(true);
      peer.signal(signal);
    });

    connectionRef.current = peer;
  };

  const answerCall = () => {
    setCallAccepted(true);
    const peer = new Peer({
      initiator: false,
      trickle: false,
      stream: stream,
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'turn:openrelay.metered.ca:80', username: 'openrelayproject', credential: 'openrelayproject' },
          { urls: 'turn:openrelay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject' }
        ]
      }
    });

    peer.on("signal", (data) => {
      socket.emit("answerCall", { signal: data, to: callerSignal.from });
    });

    peer.on("stream", (remoteStream) => {
      if (remoteVideo.current) remoteVideo.current.srcObject = remoteStream;
    });

    peer.signal(callerSignal);
    connectionRef.current = peer;
  };

  const leaveCall = () => {
    setCallEnded(true);
    socket.emit("endCall");
    if (connectionRef.current) connectionRef.current.destroy();
    window.location.reload();
  };

  const toggleMic = () => {
    if (stream) {
      const audioTrack = stream.getAudioTracks()[0];
      audioTrack.enabled = !audioTrack.enabled;
      setMicActive(audioTrack.enabled);
    }
  };

  const toggleCamera = () => {
    if (stream) {
      const videoTrack = stream.getVideoTracks()[0];
      videoTrack.enabled = !videoTrack.enabled;
      setCameraActive(videoTrack.enabled);
    }
  };

  return (
    <div style={{ backgroundColor: '#111827', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center',justifyContent: 'center', fontFamily: 'sans-serif', color: 'white' }}>

      {/* Main Video Container */}
      <div style={{ position: 'relative', width: '90vw', height: '90vh', backgroundColor: '#1f2937', borderRadius: '12px', overflow: 'hidden', display: 'flex', justifyContent: 'center', alignItems: 'center', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.5)' }}>
        
        {/* Remote Video (Takes up full container if accepted, otherwise hidden) */}
        {callAccepted && !callEnded ? (
          <video playsInline ref={remoteVideo} autoPlay style={{ width: '100%', height: '100vh', objectFit: 'fill' }} />
        ) : (
          <div style={{ color: '#9ca3af', fontSize: '1.2rem' }}>Waiting for connection...</div>
        )}

        {/* Local Video (Picture-in-Picture Style) */}
        <video 
          playsInline 
          muted 
          ref={localVideo} 
          autoPlay 
          style={{ 
            position: 'absolute', 
            bottom: '20px', 
            right: '20px', 
            width: '250px', 
            height: '200px', 
            objectFit: 'fill', 
            borderRadius: '8px', 
            border: '2px solid #374151',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.5)',
            display: cameraActive ? 'block' : '',
            backgroundColor: 'black', 
          }} 
        />

        {/* disable camera icon */}
        <img src={disableCamera} alt="disableCamera" style={{position: 'absolute', bottom: '92px', right: '115px', width: '40px', height: '40px',display: cameraActive ? 'none' : 'block', transform: 'rotateX(180deg)'}}/>
        
        {/* muted mic icon */}
        <img src={muted} alt="muteIcon" style={{position: 'absolute', bottom: '30px', right: '30px', width: '20px', height: '20px',display: micActive ? 'none' : 'block'}}/>

          {/* Control Bar */}
        <div style={{position: 'absolute', bottom: '10px'}}>
          <div style={{ display: 'flex', gap: '15px', marginTop: '30px', padding: '15px 30px', backgroundColor: '#131820', borderRadius: '50px' }}>
            <button onClick={toggleMic} style={{ width: '50px', height: '50px', borderRadius: '50%', border: 'none', cursor: 'pointer', backgroundColor: micActive ? '#374151' : '#ef4444', color: 'white', fontWeight: 'bold' }}>
              {micActive ? "Mic" : "Mute"}
            </button>
            
            <button onClick={toggleCamera} style={{ width: '50px', height: '50px', borderRadius: '50%', border: 'none', cursor: 'pointer', backgroundColor: cameraActive ? '#374151' : '#ef4444', color: 'white', fontWeight: 'bold' }}>
              {cameraActive ? "Cam" : "Off"}
            </button>

            {callAccepted && !callEnded ? (
              <button onClick={leaveCall} style={{ padding: '0 20px', borderRadius: '25px', border: 'none', cursor: 'pointer', backgroundColor: '#ef4444', color: 'white', fontWeight: 'bold' }}>
                End Call
              </button>
            ) : (
              <button onClick={callUser} style={{ padding: '0 20px', borderRadius: '25px', border: 'none', cursor: 'pointer', backgroundColor: '#3b82f6', color: 'white', fontWeight: 'bold' }}>
                Call
              </button>
            )}
          </div>
        </div>      
      </div>

      {/* Incoming Call Notification */}
      {receivingCall && !callAccepted && (
        <div style={{ position: 'fixed', top: '20px', backgroundColor: '#374151', padding: '20px', borderRadius: '10px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', gap: '20px' }}>
          <span style={{ fontWeight: 'bold' }}>Incoming Call...</span>
          <button onClick={answerCall} style={{ padding: '10px 20px', borderRadius: '5px', border: 'none', cursor: 'pointer', backgroundColor: '#10b981', color: 'white', fontWeight: 'bold' }}>
            Answer
          </button>
        </div>
      )}

    </div>
  );
}

export default App;