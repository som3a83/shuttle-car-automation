import { useState } from 'react';
import CustomizationCenter from './CustomizationCenter';

/** A reachable local preference drawer. Does not imply authenticated administrator access. */
export default function CustomizationLauncher() {
  const [open, setOpen] = useState(false);
  return <>
    <button className="customization-launcher" type="button" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(true)}>
      <span aria-hidden="true">⚙</span><span>Customize</span>
    </button>
    {open && <div className="customization-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
      <div className="customization-dialog" role="dialog" aria-modal="true" aria-label="Application customization">
        <button className="customization-dialog-close" type="button" aria-label="Close customization" onClick={() => setOpen(false)}>×</button>
        <CustomizationCenter canManage />
      </div>
    </div>}
  </>;
}
