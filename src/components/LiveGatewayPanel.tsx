import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { Language } from '../types';
import {
  fetchGatewayStatus, fetchGatewayTelemetry, getGatewaySampleState,
  type GatewayAsset, type GatewaySample, type GatewayStatus
} from '../industrial/gatewayClient';
import './LiveGatewayPanel.css';

interface Props { language: Language; }

export default function LiveGatewayPanel({ language }: Props) {
  const ar = language === 'ar';
  const [url, setUrl] = useState('');
  const [token, setToken] = useState('');
  const [status, setStatus] = useState<GatewayStatus | null>(null);
  const [samples, setSamples] = useState<Record<string, GatewaySample[]>>({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [lastChecked, setLastChecked] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!url.trim() || !token.trim()) {
      setError(ar ? 'أدخل عنوان البوابة ورمز القراءة أولًا.' : 'Enter the gateway URL and read token first.');
      return;
    }
    setBusy(true); setError('');
    try {
      const nextStatus = await fetchGatewayStatus(url, token);
      const entries = await Promise.all(nextStatus.assets.map(async (asset) => {
        try { return [asset.id, await fetchGatewayTelemetry(url, token, asset.id)] as const; }
        catch { return [asset.id, []] as const; }
      }));
      setStatus(nextStatus); setSamples(Object.fromEntries(entries)); setLastChecked(new Date().toISOString());
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Gateway connection failed.');
      setStatus(null); setSamples({});
    } finally { setBusy(false); }
  }, [url, token, ar]);

  useEffect(() => {
    if (!autoRefresh || !url.trim() || !token.trim()) return;
    const timer = window.setInterval(() => { void refresh(); }, 10_000);
    return () => window.clearInterval(timer);
  }, [autoRefresh, url, token, refresh]);

  const allAssets = useMemo(() => {
    const received = status?.assets || [];
    return [...received].sort((a, b) => a.id.localeCompare(b.id));
  }, [status]);
  const counts = useMemo(() => {
    const values = Object.values(samples).flat();
    return {
      live: values.filter((sample) => getGatewaySampleState(sample) === 'LIVE').length,
      stale: values.filter((sample) => getGatewaySampleState(sample) === 'STALE').length
    };
  }, [samples]);

  const label = (key: string) => {
    const dictionary: Record<string, [string, string]> = {
      title: ['بوابة الاتصال الصناعي المباشر', 'Live industrial gateway'],
      subtitle: ['اتصال قراءة فقط عبر بوابة OT معتمدة. بيانات الدخول تبقى في ذاكرة الشاشة ولا تُحفظ على الهاتف.', 'Read-only connection through an approved OT gateway. Credentials stay in this screen memory and are not saved on the device.'],
      url: ['عنوان البوابة الآمن (HTTPS)', 'Secure gateway URL (HTTPS)'],
      token: ['رمز القراءة', 'Read token'],
      connect: ['اختبار الاتصال وقراءة البيانات', 'Test connection & read telemetry'],
      checking: ['جارٍ الاتصال...', 'Connecting...'],
      auto: ['تحديث تلقائي كل 10 ثوانٍ', 'Auto-refresh every 10 seconds'],
      readOnly: ['قراءة فقط — أوامر الحركة والتحكم غير موجودة', 'READ ONLY — motion and control commands are not implemented'],
      commissioned: ['أجهزة مؤهلة', 'Commissioned assets'],
      live: ['قراءات حية مؤكدة الآن', 'Fresh verified live samples'],
      stale: ['قراءات قديمة', 'Stale samples'],
      notReady: ['غير مؤهل للاتصال', 'Not commissioned'],
      noSamples: ['لا توجد قراءات واردة', 'No telemetry received'],
      last: ['آخر تحديث للعرض', 'Last UI refresh'],
      missing: ['المطلوب قبل التفعيل', 'Required before commissioning'],
      noGateway: ['لم يتم الاتصال ببوابة بعد.', 'No gateway has been queried yet.']
    };
    return dictionary[key]?.[ar ? 0 : 1] || key;
  };
  const stateLabel = (sample: GatewaySample) => {
    const state = getGatewaySampleState(sample);
    if (state === 'LIVE') return ar ? 'حي ومؤكد' : 'LIVE · VERIFIED';
    if (state === 'STALE') return ar ? 'قديم' : 'STALE';
    if (state === 'UNAVAILABLE') return ar ? 'غير متاح' : 'UNAVAILABLE';
    return ar ? 'غير موثق' : 'UNVERIFIED';
  };

  return <section className="gateway-panel" aria-labelledby="gateway-panel-title">
    <div className="gateway-panel-head">
      <div>
        <span className="gateway-eyebrow">OT EDGE / READ-ONLY TELEMETRY</span>
        <h2 id="gateway-panel-title">{label('title')}</h2>
        <p>{label('subtitle')}</p>
      </div>
      <span className="gateway-readonly">{label('readOnly')}</span>
    </div>
    <div className="gateway-connect-form">
      <label><span>{label('url')}</span><input value={url} onChange={(event) => { setUrl(event.target.value); setStatus(null); setSamples({}); setLastChecked(null); setError(""); }} placeholder="https://ot-gateway.example" inputMode="url" autoComplete="url"/></label>
      <label><span>{label('token')}</span><input type="password" value={token} onChange={(event) => { setToken(event.target.value); setStatus(null); setSamples({}); setLastChecked(null); setError(""); }} placeholder={ar ? 'يُدخل يدويًا ولا يُحفظ' : 'Entered manually; never persisted'} autoComplete="off"/></label>
      <button type="button" className="gateway-connect-button" onClick={() => void refresh()} disabled={busy}>{busy ? label('checking') : label('connect')}</button>
      <label className="gateway-auto-toggle"><input type="checkbox" checked={autoRefresh} onChange={(event) => setAutoRefresh(event.target.checked)}/><span>{label('auto')}</span></label>
    </div>
    {error && <div className="gateway-error" role="alert">{error}</div>}
    {status ? <>
      <div className="gateway-metrics">
        <div><span>{label('commissioned')}</span><strong>{status.commissionedCount}/{status.assetCount}</strong></div>
        <div><span>{label('live')}</span><strong>{counts.live}</strong></div>
        <div><span>{label('stale')}</span><strong>{counts.stale}</strong></div>
        <div><span>{ar ? 'إصدار البوابة' : 'Gateway version'}</span><strong>{status.version}</strong></div>
      </div>
      <div className="gateway-assets">
        {allAssets.map((asset) => {
          const readings = samples[asset.id] || [];
          const live = readings.filter((sample) => getGatewaySampleState(sample) === 'LIVE');
          return <article className="gateway-asset" key={asset.id}>
            <div className="gateway-asset-head">
              <div><strong>{asset.id}</strong><span>{asset.manufacturer}{asset.model ? ' · ' + asset.model : ''}</span></div>
              <span className={asset.commissioned ? 'gateway-state gateway-state-ready' : 'gateway-state gateway-state-pending'}>
                {asset.commissioned ? (ar ? 'مهيأ' : 'COMMISSIONED') : label('notReady')}
              </span>
            </div>
            {asset.transports.length > 0 || asset.protocols.length > 0 ? <div className="gateway-muted">{ar ? 'وسيلة الاتصال' : 'Transport'}: {asset.transports.join(', ') || '—'} · {ar ? 'البروتوكول' : 'Protocol'}: {asset.protocols.join(', ') || '—'}</div> : null}
            {asset.commissioned
              ? live.length
                ? <div className="gateway-readings">{live.slice(0, 5).map((sample) => <div key={sample.tag + '-' + sample.receivedAt}><span>{sample.tag}</span><strong>{String(sample.value)}{sample.unit || ''}</strong><small>{stateLabel(sample)}</small></div>)}</div>
                : <p className="gateway-muted">{label('noSamples')}</p>
              : <div className="gateway-missing"><strong>{label('missing')}:</strong> {asset.missing.join(' · ')}</div>}
            {readings.length > 0 && live.length === 0 && <p className="gateway-muted">{ar ? 'وصلت بيانات، لكن لم تجتز شروط الاعتماد كقراءة حية حديثة.' : 'Samples arrived, but none passed fresh live-provenance checks.'}</p>}
          </article>;
        })}
      </div>
      <p className="gateway-last-check">{label('last')}: {lastChecked ? new Date(lastChecked).toLocaleString(ar ? 'ar-EG' : 'en-GB') : '—'}</p>
    </> : <div className="gateway-empty">{label('noGateway')}</div>}
    <div className="gateway-safety-note">
      {ar
        ? 'تنبيه تشغيل: هذه الشاشة لا تبحث عن عناوين الشبكة ولا تفحص منافذ PLC. لا يمكن اعتبار أي قراءة حقيقية إلا بعد مطابقة الموديل والفيرموير والـ Adapter وخريطة Tags المعتمدة مع شاشة HMI.'
        : 'Commissioning rule: this screen does not scan networks or probe PLC ports. Readings are trusted only after matching exact model, firmware, adapter and approved tag map against the physical HMI.'}
    </div>
  </section>;
}
