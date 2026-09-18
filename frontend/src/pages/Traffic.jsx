import {useEffect,useState} from "react";
import api from "../services/api";
import TrafficMap from "../components/TrafficMap";
import StatCard from "../components/StatCard";

export default function Traffic(){
 const [points,setPoints]=useState([]),[summary,setSummary]=useState({});
 const load=()=>Promise.all([api.get("/traffic/points"),api.get("/traffic/summary")]).then(([a,b])=>{setPoints(a.data);setSummary(b.data)});
 useEffect(()=>{load();const id=setInterval(load,30000);return()=>clearInterval(id)},[]);
 return <><div className="page-title"><div><h1>Live Traffic</h1><p>Real-time traffic observations, vehicle density and road status.</p></div></div>
 <div className="stats"><StatCard label="Monitored locations" value={summary.monitoredLocations||0}/><StatCard label="Low" value={summary.low||0}/><StatCard label="Medium" value={summary.medium||0}/><StatCard label="High" value={summary.high||0}/></div>
 <div className="panel"><h3>Traffic network</h3><TrafficMap points={points}/></div>
 <div className="panel"><h3>Traffic observations</h3><div className="table">{points.map(p=><div className="table-row" key={p.id}><b>{p.road}</b><span>{p.speed} km/h</span><span>{p.travelTime} min</span><span>{p.vehicleCount} vehicles</span><span className={`badge ${p.status.toLowerCase()}`}>{p.status}</span></div>)}</div></div></>
}
