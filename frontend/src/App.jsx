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
  
  const [userName, setUserName] = useState("");
  const [remoteUserName, setRemoteUserName] = useState("Friend");
  const [roomId, setRoomId] = useState("");
  const [inRoom, setInRoom] = useState(false);

  const [receivingCall, setReceivingCall] = useState(false);
  const [callerSignal, setCallerSignal] = useState();
  const [callAccepted, setCallAccepted] = useState(false);
  const [callEnded, setCallEnded] = useState(false);
  const [micActive, setMicActive] = useState(true);
  const [cameraActive, setCameraActive] = useState(true);
  
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isReceivingScreen, setIsReceivingScreen] = useState(false);
  const [remoteScreenStream, setRemoteScreenStream] = useState(null);

  const localVideo = useRef();
  const remoteVideo = useRef();
  const connectionRef = useRef();
  const isInitialSignal = useRef(true); 
  
  const localScreenVideo = useRef();
  const remoteScreenVideo = useRef();
  const screenStreamRef = useRef();

  useEffect(() => {
    socket.connect();

    navigator.mediaDevices.getUserMedia({ video: true, audio: true }).then((mediaStream) => {
      setStream(mediaStream);
    });

    socket.on("hey", (data) => {
      setReceivingCall(true);
      setCallerSignal(data.signal);
      if (data.userName) setRemoteUserName(data.userName);
    });

    socket.on("receiveSignal", (signal) => {
      if (connectionRef.current) {
        connectionRef.current.signal(signal);
      }
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

  useEffect(() => {
    if (inRoom && localVideo.current && stream) {
      localVideo.current.srcObject = stream;
    }
  }, [inRoom, stream]);

  useEffect(() => {
    if (isScreenSharing && localScreenVideo.current && screenStreamRef.current) {
      localScreenVideo.current.srcObject = screenStreamRef.current;
    }
  }, [isScreenSharing]);

  useEffect(() => {
    if (isReceivingScreen && remoteScreenVideo.current && remoteScreenStream) {
      remoteScreenVideo.current.srcObject = remoteScreenStream;
    }
  }, [isReceivingScreen, remoteScreenStream]);

  const createPrivateSession = () => {
    if (!userName.trim()) return alert("Please enter your name first");
    const newRoom = Math.random().toString(36).substring(2, 10);
    setRoomId(newRoom);
    socket.emit("join-room", newRoom);
    setInRoom(true);
  };

  const joinRoom = () => {
    if (!userName.trim()) return alert("Please enter your name first");
    if (roomId.trim()) {
      socket.emit("join-room", roomId);
      setInRoom(true);
    }
  };

  const handleIncomingStream = (incomingStream) => {
    const mainStream = remoteVideo.current?.srcObject;
    if (!mainStream) {
      if (remoteVideo.current) remoteVideo.current.srcObject = incomingStream;
    } else if (mainStream.id !== incomingStream.id) {
      setRemoteScreenStream(incomingStream);
      setIsReceivingScreen(true);
    }
  };

  const callUser = () => {
    isInitialSignal.current = true;
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
      if (isInitialSignal.current) {
        socket.emit("callUser", { signalData: data, roomId, userName });
        isInitialSignal.current = false;
      } else {
        socket.emit("sendSignal", { signal: data, roomId });
      }
    });

    peer.on("stream", handleIncomingStream);
    peer.on("track", (track, incomingStream) => handleIncomingStream(incomingStream));

    socket.on("callAccepted", (data) => {
      setCallAccepted(true);
      peer.signal(data.signal);
      if (data.userName) setRemoteUserName(data.userName);
    });

    connectionRef.current = peer;
  };

  const answerCall = () => {
    isInitialSignal.current = true;
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
      if (isInitialSignal.current) {
        socket.emit("answerCall", { signal: data, to: callerSignal.from, roomId, userName });
        isInitialSignal.current = false;
      } else {
        socket.emit("sendSignal", { signal: data, roomId });
      }
    });

    peer.on("stream", handleIncomingStream);
    peer.on("track", (track, incomingStream) => handleIncomingStream(incomingStream));

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

        screenStreamRef.current = screenStream;
        setIsScreenSharing(true); 

        if (connectionRef.current) {
          connectionRef.current.addStream(screenStream);
        }

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

  const nameBadgeStyle = {
    position: 'absolute',
    bottom: '10px',
    left: '10px',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    color: 'white',
    padding: '4px 8px',
    borderRadius: '4px',
    fontSize: '0.9rem',
    fontWeight: 'bold',
    zIndex: 5
  };

  // Dynamic calculations for the grid layout
  const activeScreensCount = (callAccepted && !callEnded ? 1 : 0) + (isScreenSharing ? 1 : 0) + (isReceivingScreen ? 1 : 0);
  const gridColumns = activeScreensCount <= 1 ? '1fr' : '1fr 1fr';

  const gridItemStyle = {
    position: 'relative',
    backgroundColor: '#000',
    borderRadius: '8px',
    overflow: 'hidden',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: '100%'
  };

  return (
    <div style={{ backgroundColor: '#111827', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center',justifyContent: 'center', fontFamily: 'sans-serif', color: 'white' }}>

      {!inRoom ? (
        <div style={{ backgroundColor: '#1f2937', padding: '40px', borderRadius: '12px', textAlign: 'center', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.5)' }}>
          <h2 style={{ marginBottom: '20px' }}>Start a Private Session</h2>
          
          <input 
            type="text" 
            placeholder="Enter Your Name" 
            value={userName} 
            onChange={(e) => setUserName(e.target.value)}
            style={{ padding: '10px', borderRadius: '5px', border: 'none', width: '100%', boxSizing: 'border-box', marginBottom: '20px', backgroundColor: '#374151', color: 'white' }}
          />

          <button onClick={createPrivateSession} style={{ padding: '10px 20px', backgroundColor: '#8b5cf6', color: 'white', border: 'none', borderRadius: '5px', fontWeight: 'bold', cursor: 'pointer', marginBottom: '20px', width: '100%' }}>
            Create New Room
          </button>
          
          <div style={{ margin: '10px 0 20px 0', color: '#9ca3af' }}>OR</div>
          
          <div style={{ display: 'flex', gap: '10px' }}>
            <input 
              type="text" 
              placeholder="Enter Room Code" 
              value={roomId} 
              onChange={(e) => setRoomId(e.target.value)}
              style={{ padding: '10px', borderRadius: '5px', border: 'none', flex: 1, backgroundColor: '#374151', color: 'white' }}
            />
            <button onClick={joinRoom} style={{ padding: '10px 20px', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '5px', fontWeight: 'bold', cursor: 'pointer' }}>
              Join
            </button>
          </div>
        </div>
      ) : (

      <div style={{ position: 'relative', width: '95vw', height: '90vh', backgroundColor: '#1f2937', borderRadius: '12px', overflow: 'hidden', display: 'flex', justifyContent: 'center', alignItems: 'center', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.5)' }}>
        
        <div style={{ position: 'absolute', top: '20px', left: '20px', backgroundColor: 'rgba(0,0,0,0.5)', padding: '10px', borderRadius: '8px', zIndex: 10 }}>
            Room Code: <span style={{ color: '#10b981', fontWeight: 'bold' }}>{roomId}</span>
        </div>

        {/* Dynamic CSS Grid Layout */}
        <div style={{ 
            display: 'grid', 
            gridTemplateColumns: gridColumns, 
            gridAutoRows: '1fr', 
            gap: '15px', 
            width: '100%', 
            height: 'calc(100% - 100px)', 
            padding: '20px', 
            paddingBottom: '0',
            boxSizing: 'border-box' 
        }}>
            
          {/* Remote Camera Video */}
          <div style={gridItemStyle}>
            {callAccepted && !callEnded ? (
              <>
                <video playsInline ref={remoteVideo} autoPlay style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                <div style={nameBadgeStyle}>{remoteUserName}</div>
              </>
            ) : (
              <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', color: '#9ca3af', fontSize: '1.2rem' }}>
                Waiting for friend to join...
              </div>
            )}
          </div>

          {/* Local Shared Screen */}
          {isScreenSharing && (
            <div style={{ ...gridItemStyle, border: '2px solid #10b981' }}>
               <video playsInline muted ref={localScreenVideo} autoPlay style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
               <div style={nameBadgeStyle}>{userName}'s Screen</div>
            </div>
          )}

          {/* Remote Shared Screen */}
          {isReceivingScreen && (
            <div style={{ ...gridItemStyle, border: '2px solid #3b82f6' }}>
               <video playsInline ref={remoteScreenVideo} autoPlay style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
               <div style={nameBadgeStyle}>{remoteUserName}'s Screen</div>
            </div>
          )}
        </div>

        {/* Local Video (Floating Picture-in-Picture) */}
        <div style={{ position: 'absolute', bottom: '90px', right: '20px', width: '200px', height: '150px', borderRadius: '8px', overflow: 'hidden', border: '2px solid #374151', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.5)', display: cameraActive ? 'block' : 'none', backgroundColor: 'black', zIndex: 10 }}>
          <video playsInline muted ref={localVideo} autoPlay style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          <div style={nameBadgeStyle}>{userName || "You"}</div>
          <img src={muted} alt="muteIcon" style={{position: 'absolute', top: '10px', right: '10px', width: '20px', height: '20px', display: micActive ? 'none' : 'block', zIndex: 11}}/>
        </div>

        {/* Control Bar */}
        <div style={{position: 'absolute', bottom: '10px', zIndex: 20}}>
          <div style={{ display: 'flex', gap: '15px', padding: '15px 30px', backgroundColor: '#131820', borderRadius: '50px' }}>
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

      {receivingCall && !callAccepted && inRoom && (
        <div style={{ position: 'fixed', top: '20px', backgroundColor: '#374151', padding: '20px', borderRadius: '10px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', gap: '20px', zIndex: 50 }}>
          <span style={{ fontWeight: 'bold' }}>{remoteUserName} is calling...</span>
          <button onClick={answerCall} style={{ padding: '10px 20px', borderRadius: '5px', border: 'none', cursor: 'pointer', backgroundColor: '#10b981', color: 'white', fontWeight: 'bold' }}>
            Answer
          </button>
        </div>
      )}

    </div>
  );
}

export default App;