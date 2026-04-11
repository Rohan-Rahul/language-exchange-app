import { useEffect, useState, useRef } from "react";
import { io } from 'socket.io-client';
import Peer from 'simple-peer';
import muted from '../src/assets/mute.png';
import disableCamera from '../src/assets/disableCamera.png';

const URL = "https://language-exchange-app.onrender.com"; 

const socket = io(URL, {
  autoConnect: false 
});

function App() {
  const [isConnected, setIsConnected] = useState(socket.connected);
  const [stream, setStream] = useState(null);
  
  // Room States
  const [roomId, setRoomId] = useState("");
  const [inRoom, setInRoom] = useState(false);

  // Call States
  const [receivingCall, setReceivingCall] = useState(false);
  const [callerSignal, setCallerSignal] = useState();
  const [callAccepted, setCallAccepted] = useState(false);
  const [callEnded, setCallEnded] = useState(false);
  const [micActive, setMicActive] = useState(true);
  const [cameraActive, setCameraActive] = useState(true);
  
  // Screen Sharing States
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isReceivingScreen, setIsReceivingScreen] = useState(false);
  const [remoteScreenStream, setRemoteScreenStream] = useState(null);

  const localVideo = useRef();
  const remoteVideo = useRef();
  const connectionRef = useRef();
  
  const localScreenVideo = useRef();
  const remoteScreenVideo = useRef();
  const screenStreamRef = useRef();

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
      window.location.reload();
    });

    socket.on("screenShareStopped", () => {
      setIsReceivingScreen(false);
      setRemoteScreenStream(null);
      if (remoteScreenVideo.current) {
        remoteScreenVideo.current.srcObject = null;
      }
    });
  }, []);

  // Fix: Wait for the DOM to render the remoteScreenVideo element before attaching the stream
  useEffect(() => {
    if (isReceivingScreen && remoteScreenVideo.current && remoteScreenStream) {
      remoteScreenVideo.current.srcObject = remoteScreenStream;
    }
  }, [isReceivingScreen, remoteScreenStream]);

  // Room Functions
  const createPrivateSession = () => {
    const newRoom = Math.random().toString(36).substring(2, 10);
    setRoomId(newRoom);
    socket.emit("join-room", newRoom);
    setInRoom(true);
  };

  const joinRoom = () => {
    if (roomId.trim()) {
      socket.emit("join-room", roomId);
      setInRoom(true);
    }
  };

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
      socket.emit("callUser", { signalData: data, roomId });
    });

    peer.on("stream", (incomingStream) => {
      if (!remoteVideo.current.srcObject) {
        remoteVideo.current.srcObject = incomingStream;
      } else if (remoteVideo.current.srcObject.id !== incomingStream.id) {
        setRemoteScreenStream(incomingStream);
        setIsReceivingScreen(true);
      }
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
      socket.emit("answerCall", { signal: data, to: callerSignal.from, roomId });
    });

    peer.on("stream", (incomingStream) => {
      if (!remoteVideo.current.srcObject) {
        remoteVideo.current.srcObject = incomingStream;
      } else if (remoteVideo.current.srcObject.id !== incomingStream.id) {
        setRemoteScreenStream(incomingStream);
        setIsReceivingScreen(true);
      }
    });

    peer.signal(callerSignal);
    connectionRef.current = peer;
  };

  const leaveCall = () => {
    setCallEnded(true);
    socket.emit("endCall", roomId);
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

  const toggleScreenShare = async () => {
    if (!isScreenSharing) {
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: { width: 1920, height: 1080, frameRate: 60 },
          audio: true
        });

        if (connectionRef.current) {
          connectionRef.current.addStream(screenStream);
        }

        if (localScreenVideo.current) {
          localScreenVideo.current.srcObject = screenStream;
        }

        screenStreamRef.current = screenStream;
        setIsScreenSharing(true);

        screenStream.getVideoTracks()[0].onended = () => {
          stopScreenShare();
        };
      } catch (error) {
        console.error("Screen sharing failed:", error);
      }
    } else {
      stopScreenShare();
    }
  };

  const stopScreenShare = () => {
    if (connectionRef.current && screenStreamRef.current) {
      connectionRef.current.removeStream(screenStreamRef.current);
    }
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(track => track.stop());
    }
    if (localScreenVideo.current) {
      localScreenVideo.current.srcObject = null;
    }
    setIsScreenSharing(false);
    socket.emit("stopScreenShare", roomId);
  };

  return (
    <div style={{ backgroundColor: '#111827', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center',justifyContent: 'center', fontFamily: 'sans-serif', color: 'white' }}>

      {/* Lobby / Room Creation UI */}
      {!inRoom ? (
        <div style={{ backgroundColor: '#1f2937', padding: '40px', borderRadius: '12px', textAlign: 'center', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.5)' }}>
          <h2 style={{ marginBottom: '20px' }}>Start a Private Session</h2>
          <button onClick={createPrivateSession} style={{ padding: '10px 20px', backgroundColor: '#8b5cf6', color: 'white', border: 'none', borderRadius: '5px', fontWeight: 'bold', cursor: 'pointer', marginBottom: '20px', width: '100%' }}>
            Create New Room
          </button>
          
          <div style={{ margin: '20px 0', color: '#9ca3af' }}>OR</div>
          
          <input 
            type="text" 
            placeholder="Enter Room Code" 
            value={roomId} 
            onChange={(e) => setRoomId(e.target.value)}
            style={{ padding: '10px', borderRadius: '5px', border: 'none', width: '200px', marginRight: '10px', backgroundColor: '#374151', color: 'white' }}
          />
          <button onClick={joinRoom} style={{ padding: '10px 20px', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '5px', fontWeight: 'bold', cursor: 'pointer' }}>
            Join
          </button>
        </div>
      ) : (

      /* Main Video Container (Only shows when in a room) */
      <div style={{ position: 'relative', width: '90vw', height: '90vh', backgroundColor: '#1f2937', borderRadius: '12px', overflow: 'hidden', display: 'flex', justifyContent: 'center', alignItems: 'center', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.5)' }}>
        
        {/* Room Info Display */}
        <div style={{ position: 'absolute', top: '20px', left: '20px', backgroundColor: 'rgba(0,0,0,0.5)', padding: '10px', borderRadius: '8px', zIndex: 10 }}>
            Room Code: <span style={{ color: '#10b981', fontWeight: 'bold' }}>{roomId}</span>
        </div>

        {/* Dynamic Display for Screen Share and Webcams */}
        <div style={{ display: 'flex', width: '100%', height: '100%', flexDirection: (isScreenSharing || isReceivingScreen) ? 'row' : 'column' }}>
            
          {/* Remote Camera Video */}
          <div style={{ flex: (isScreenSharing || isReceivingScreen) ? 1 : 'none', width: '100%', height: '100%', position: 'relative' }}>
            {callAccepted && !callEnded ? (
              <video playsInline ref={remoteVideo} autoPlay style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            ) : (
              <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', color: '#9ca3af', fontSize: '1.2rem' }}>
                Waiting for friend to join...
              </div>
            )}
          </div>

          {/* Local Shared Screen */}
          {isScreenSharing && (
            <div style={{ flex: 1, borderLeft: '2px solid #374151', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#000' }}>
               <video playsInline muted ref={localScreenVideo} autoPlay style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            </div>
          )}

          {/* Remote Shared Screen */}
          {isReceivingScreen && (
            <div style={{ flex: 2, borderLeft: '2px solid #374151', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#000' }}>
               <video playsInline ref={remoteScreenVideo} autoPlay style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            </div>
          )}
        </div>

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

        <img src={disableCamera} alt="disableCamera" style={{position: 'absolute', bottom: '92px', right: '115px', width: '40px', height: '40px',display: cameraActive ? 'none' : 'block', transform: 'rotateX(180deg)'}}/>
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

            {callAccepted && !callEnded && (
              <button onClick={toggleScreenShare} style={{ padding: '0 20px', borderRadius: '25px', border: 'none', cursor: 'pointer', backgroundColor: isScreenSharing ? '#f59e0b' : '#374151', color: 'white', fontWeight: 'bold' }}>
                {isScreenSharing ? "Stop Share" : "Share"}
              </button>
            )}

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

      )}

      {/* Incoming Call Notification */}
      {receivingCall && !callAccepted && inRoom && (
        <div style={{ position: 'fixed', top: '20px', backgroundColor: '#374151', padding: '20px', borderRadius: '10px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', gap: '20px', zIndex: 50 }}>
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