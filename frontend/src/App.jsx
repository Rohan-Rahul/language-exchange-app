import { useEffect,useState,useRef } from "react";
import { io } from 'socket.io-client';
import Peer from 'simple-peer';

//Connect to backend server with port 5000
const URL = import.meta.env.PROD ? undefined : 'http://localhost:5000';

const socket = io(URL, {
  autoConnect: false //connect manually when components mounts
});

function App(){
  const [isConnected, setIsConnected] = useState(socket.connected);
  const [stream, setStream] = useState(null);
  const [receivingCall, setReceivingCall] = useState(false);
  const [callerSignal, setCallerSignal] = useState();
  const [callAccepted, setCallAccepted] = useState(false);

  //these "refs" allow React to control the <video> elements
  const localVideo = useRef();
  const remoteVideo = useRef();
  const connectionRef = useRef();

  useEffect(()=>{
    socket.connect();

    navigator.mediaDevices.getUserMedia({video:true, audio: true}).then((mediaStream)=>{
      setStream(mediaStream);
      if(localVideo.current) localVideo.current.srcObject = mediaStream;
    });

    socket.on("hey", (data)=>{
      setReceivingCall(true);
      setCallerSignal(data.signal);
    });
  }, []);

  //function to start a call
  const callUser = () => {
    const peer = new Peer({initiator: true, trickle: false, stream: stream});

    peer.on("signal", (data)=>{
      socket.emit("callUser", {signalData: data});
    });

    peer.on("stream", (remoteStream)=>{
      if(remoteVideo.current) remoteVideo.current.srcObject=remoteStream;
    });

    socket.on("callAccepted", (signal)=>{
      setCallAccepted(true);
      peer.signal(signal);
    });

    connectionRef.current = peer;
  };
  
  //function to answer a call
  const answerCall = ()=>{
    setCallAccepted(true);
    const peer = new Peer({initiator: false, trickle: false, stream: stream});

    peer.on("signal", (data)=>{
      socket.emit("answerCall", {signal: data});
    });

    peer.on("stream", (remoteStream)=>{
      remoteVideo.current.srcObject = remoteStream;
    });

    peer.signal(callerSignal);
    connectionRef.current=peer;
  }

  return (
    <div style={{ padding: '20px', backgroundColor: '#1a1a1a', color: 'white', minHeight: '100vh' }}>
      <h1>Language Exchange</h1>
      
      <div style={{ marginBottom: '20px' }}>
        {receivingCall && !callAccepted ? (
          <button onClick={answerCall} style={{ padding: '10px 20px', backgroundColor: '#4ade80' }}>Answer Call</button>
        ) : (
          <button onClick={callUser} style={{ padding: '10px 20px', backgroundColor: '#3b82f6', color: 'white' }}>Start Call</button>
        )}
      </div>

      <div style={{ display: 'flex', gap: '20px' }}>
        <video playsInline muted ref={localVideo} autoPlay style={{ width: '400px', border: '2px solid #4ade80' }} />
        {callAccepted && <video playsInline ref={remoteVideo} autoPlay style={{ width: '400px', border: '2px solid #3b82f6' }} />}
      </div>
    </div>
  );
}

export default App;
