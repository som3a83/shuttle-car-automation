import React,{useState} from 'react';
import {Capacitor} from '@capacitor/core';
import {NetworkInspector,type LanDevice,type WifiInfo,type WifiNetwork} from '../native/NetworkInspector';
import './NetworkDiscovery.css';
type Props={language:'ar'|'en'};
export default function NetworkDiscovery({language}:Props){
 const ar=language==='ar',native=Capacitor.isNativePlatform();
 const [wifi,setWifi]=useState<WifiInfo|null>(null),[networks,setNetworks]=useState<WifiNetwork[]>([]),[devices,setDevices]=useState<LanDevice[]>([]);
 const [busy,setBusy]=useState(''),[error,setError]=useState(''),[note,setNote]=useState(''),[subnet,setSubnet]=useState('');
 const run=async(kind:string,task:()=>Promise<void>)=>{setBusy(kind);setError('');try{await task()}catch(e){setError(e instanceof Error?e.message:String(e))}finally{setBusy('')}};
 const permission=()=>run('permission',async()=>{const r=await NetworkInspector.requestWifiPermission();if(!r.granted)throw new Error(ar?'لم يمنح أندرويد إذن الموقع والأجهزة القريبة.':'Android did not grant Wi-Fi discovery permissions.')});
 const read=()=>run('wifi',async()=>setWifi(await NetworkInspector.getWifiInfo()));
 const scan=()=>run('scan',async()=>{const r=await NetworkInspector.scanWifiNetworks();setNetworks(r.networks);setNote(r.note)});
 const lan=()=>run('lan',async()=>{const r=await NetworkInspector.scanLocalNetwork();setDevices(r.devices);setSubnet(r.subnet);setNote(r.note)});
 return <section className="network-discovery">
 <div className="nd-heading"><div><span className="eyebrow">ANDROID RADIO / LOCAL NETWORK</span><h3>{ar?'مركز اكتشاف الشبكات والأجهزة':'Network & device discovery center'}</h3><p>{ar?'بحث يدوي داخل الشبكة المحلية الحالية وبموافقة المستخدم.':'User-initiated discovery, limited to the current local network.'}</p></div><span className={'nd-platform '+(native?'native':'web')}>{native?'ANDROID NATIVE':'WEB LIMITED'}</span></div>
 {!native&&<div className="nd-warning">{ar?'هذه الوظائف تعمل في نسخة Android الأصلية فقط.':'Native Android build required for Wi-Fi and LAN discovery.'}</div>}
 <div className="nd-actions">
 <button className="btn-secondary" disabled={!native||!!busy} onClick={permission}>{ar?'طلب صلاحيات Wi-Fi':'Request Wi-Fi permission'}</button>
 <button className="btn-secondary" disabled={!native||!!busy} onClick={()=>void NetworkInspector.openWifiSettings()}>{ar?'إعدادات Wi-Fi':'Wi-Fi settings'}</button>
 <button className="btn-secondary" disabled={!native||!!busy} onClick={()=>void NetworkInspector.openBluetoothSettings()}>{ar?'إعدادات Bluetooth':'Bluetooth settings'}</button>
 <button className="btn-primary" disabled={!native||!!busy} onClick={read}>{ar?'قراءة الشبكة الحالية':'Read connected Wi-Fi'}</button>
 <button className="btn-primary" disabled={!native||!!busy} onClick={scan}>{busy==='scan'?(ar?'جار البحث…':'Scanning…'):(ar?'بحث عن شبكات Wi-Fi':'Scan Wi-Fi networks')}</button>
 <button className="btn-primary" disabled={!native||!!busy} onClick={lan}>{busy==='lan'?(ar?'جار فحص الشبكة…':'Scanning LAN…'):(ar?'فحص أجهزة الشبكة الحالية':'Scan current LAN')}</button>
 </div>
 {error&&<div className="nd-error" role="alert">{error}</div>}
 {wifi&&<div className="nd-card"><h4>{ar?'الشبكة المتصل بها الهاتف':'Current Wi-Fi connection'}</h4><div className="nd-grid">
 <div><small>SSID</small><strong>{wifi.ssid||'Unavailable / permission restricted'}</strong></div><div><small>IP</small><strong>{wifi.ipAddress||'—'}</strong></div><div><small>Gateway</small><strong>{wifi.gateway||'—'}</strong></div><div><small>BSSID</small><strong>{wifi.bssid||'—'}</strong></div><div><small>Link speed</small><strong>{wifi.linkSpeedMbps} Mbps</strong></div><div><small>Frequency</small><strong>{wifi.frequencyMhz} MHz</strong></div></div><p className="nd-muted">{wifi.macAddress}</p></div>}
 {networks.length>0&&<div className="nd-card"><h4>{ar?'شبكات Wi-Fi المكتشفة':'Discovered Wi-Fi networks'} · {networks.length}</h4>{networks.map((n,i)=><div className="nd-row" key={n.bssid||i}><div><strong>{n.ssid}</strong><small>{n.security} · {n.frequencyMhz} MHz · {n.bssid}</small></div><span>{n.levelDbm} dBm</span></div>)}</div>}
 {(devices.length>0||subnet)&&<div className="nd-card"><h4>{ar?'أجهزة الشبكة المكتشفة':'Discovered LAN devices'} · {devices.length}</h4><p className="nd-muted">{subnet} · {ar?'الشبكة المحلية فقط':'Local subnet only'}</p>{devices.map(d=><div className="nd-row" key={d.ipAddress}><div><strong>{d.hostName&&d.hostName!==d.ipAddress?d.hostName:'Unknown device'}</strong><small>{d.ipAddress} · TCP {d.openPorts.join(', ')||'No identified service'} · {d.reachable?'Reachable':'Port response only'}</small></div><span>{ar?'تم الاكتشاف':'Discovered'}</span></div>)}</div>}
 {note&&<p className="nd-muted">{note}</p>}
 <div className="nd-disclaimer">{ar?'قيود أندرويد: قد تُحجب أسماء الشبكات ونتائج البحث دون الأذونات وخدمات الموقع. لا يستطيع التطبيق إجبار النظام على تشغيل Wi-Fi أو Bluetooth. لا تتاح عناوين MAC أو البيانات الخاصة للأجهزة عادةً. قد تخفي الجدران النارية بعض الأجهزة.':'Android may hide SSIDs and scan results without permissions and Location services. Apps cannot forcibly toggle Wi-Fi or Bluetooth. MAC addresses and private device data are generally unavailable. Firewalls may hide devices.'}</div>
 </section>;
}