import { useEffect,useState } from "react";
import { io } from 'socket.io-client';

//Connect to backend server with port 5000
const URL = import.meta.env.PROD ? undefined : 'http://localhost:5000';

const socket = io(URL, {
  autoConnect: false //connect manually when components mounts
});

function App(){
  const [isConnected, setIsConnected] = useState(socket.connected);

  useEffect(()=>{
    socket.connect();

    function onConnect(){
    setIsConnected(true);
    console.log('Connected to Server with ID: ', socket.id);
    }

    function onDisconnect(){
      setIsConnected(false);
      console.log('Disconnected from server');
    }

    //setup event listeners
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);

    //clean up event listener when component unmounts
    return()=>{
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.disconnect();
    };
  }, []);
  
  return (
    <div style={{padding: '20px', fontFamily: 'sans-serif'}}>
      <h1>Language Exchange Interface</h1>
      <p>
        Server Status:
        <strong style={{color: isConnected ? 'green' : 'red', marginLeft: '8px'}}>
          {isConnected ? 'Connected' : 'Disconnected'}
        </strong>
      </p>

      <div style={{display:'flex', gap: '20px', marginTop: '20px'}}>
        <div style={{width: '400px', height: '300px', backgroundColor: '#333', color: 'white', display: 'flex', alignItems:'center',justifyContent:'center'}}>Local Video (You)</div>
        <div style={{width: '400px', height: '300px', backgroundColor: '#333', color: 'white', display: 'flex', alignItems:'center',justifyContent:'center'}}>Remote Video (Peer)</div>
      </div>
    </div>
  );
}

export default App;
