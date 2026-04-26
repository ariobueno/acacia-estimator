import { useState, useRef, useCallback } from "react";
import IntegrationsPanel from "./IntegrationsPanel.jsx";
import EstimateHistory from "./EstimateHistory.jsx";

// ─── Pricing Constants ────────────────────────────────────────────────────────
const CABINET_PRICING = {
  "Flat Door + Handles": 12,
  "Gola System": 16,
  "Slim Shaker": 18,
  "MDF Shaker": 25,
  "Lioher / Egger": 22,
  "Maple Wood Shaker": 45,
};

// Box material affects pricing: plywood = standard rate, melamine = -10%
const BOX_MATERIALS = [
  { label: "Plywood (standard)", value: "plywood", discount: 0 },
  { label: "Melamine (-10%)", value: "melamine", discount: 0.10 },
];

// Door/drawer finish options (separate from box material)
const DOOR_FINISHES = ["Painted", "Stained", "Veneer", "Thermofoil", "Laminate", "Natural Wood", "Other"];

const CLOSET_MATERIALS = [
  { label: "White Melamine (standard)", value: "white_melamine", rate: 14 },
  { label: "MDF", value: "mdf", rate: 18 },
  { label: "Melamine (other color)", value: "melamine_other", rate: 18 },
  { label: "Wood – Painted", value: "wood_painted", rate: 18 },
  { label: "Wood – Stained", value: "wood_stained", rate: 18 },
  { label: "Wood – Veneer", value: "wood_veneer", rate: 18 },
];

const BUFFER = 0.15;
const DEFAULT_CT_PRICE = 25;
const DEFAULT_LED_PRICE = 750;  // per run, user specifies number of runs
const DEFAULT_DEMO_PRICE = 650;
const DEFAULT_INSTALL_PCT = 10;

const CAT = {
  cabinets: { label: "Cabinets", color: "#c8a84b", pricingMode: "tiered", defaultDepth: 25 },
  vanity:   { label: "Vanity",   color: "#7a9ebf", pricingMode: "flat", flatRate: 30, defaultDepth: 21 },
  wallUnit: { label: "Wall Unit",color: "#8a6abf", pricingMode: "flat", flatRate: 30 },
  closet:   { label: "Closet",   color: "#6abf8a", pricingMode: "closet" },
};

function getRoomCat(type) {
  if (!type) return "cabinets";
  const t = type.toLowerCase();
  if (["master bath","bath 2","bath 3","powder room"].includes(t)) return "vanity";
  if (["master closet","walk-in closet","reach-in closet","linen closet"].includes(t)) return "closet";
  if (["living room","bedroom","dining room","wall unit"].includes(t)) return "wallUnit";
  return "cabinets";
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const S = {
  app: { minHeight:"100vh", background:"#f7f5f0", fontFamily:"'Georgia',serif", color:"#1a1714" },
  header: { background:"#1a1714", padding:"16px 28px", display:"flex", alignItems:"center", gap:12 },
  logo: { width:34, height:34, background:"#c8a84b", borderRadius:4, display:"flex", alignItems:"center", justifyContent:"center", fontWeight:900, fontSize:17, color:"#1a1714" },
  logoText: { color:"#c8a84b", fontSize:12, fontWeight:700, letterSpacing:"0.14em", textTransform:"uppercase" },
  logoSub: { color:"#4a4030", fontSize:10, letterSpacing:"0.1em", marginTop:1 },
  wrap: { maxWidth:820, margin:"0 auto", padding:"28px 18px 60px" },
  card: { background:"#fff", border:"1px solid #e8e2d8", borderRadius:10, padding:"26px 28px", marginBottom:18, boxShadow:"0 1px 4px rgba(0,0,0,.05)" },
  label: { fontSize:10, fontWeight:700, letterSpacing:"0.12em", textTransform:"uppercase", color:"#8a7a60", marginBottom:5, display:"block" },
  input: { width:"100%", border:"1px solid #ddd8cc", borderRadius:6, padding:"8px 11px", fontSize:13, fontFamily:"Georgia,serif", color:"#1a1714", background:"#fdfcfa", outline:"none", boxSizing:"border-box" },
  select: { width:"100%", border:"1px solid #ddd8cc", borderRadius:6, padding:"8px 11px", fontSize:13, fontFamily:"Georgia,serif", color:"#1a1714", background:"#fdfcfa", outline:"none", boxSizing:"border-box" },
  btnGold: { background:"#c8a84b", color:"#1a1714", border:"none", borderRadius:6, padding:"10px 20px", fontSize:11, fontWeight:700, letterSpacing:"0.1em", textTransform:"uppercase", cursor:"pointer", fontFamily:"Georgia,serif" },
  btnDark: { background:"#1a1714", color:"#c8a84b", border:"none", borderRadius:6, padding:"10px 20px", fontSize:11, fontWeight:700, letterSpacing:"0.1em", textTransform:"uppercase", cursor:"pointer", fontFamily:"Georgia,serif" },
  btnGhost: { background:"transparent", color:"#8a7a60", border:"1px solid #ddd8cc", borderRadius:6, padding:"7px 14px", fontSize:10, fontWeight:700, letterSpacing:"0.1em", textTransform:"uppercase", cursor:"pointer", fontFamily:"Georgia,serif" },
  row: { display:"flex", gap:12, marginBottom:14 },
  col: { flex:1 },
  hint: { fontSize:10, color:"#a09080", marginTop:3, lineHeight:1.5 },
  outputBox: { background:"#fdfcfa", border:"1px solid #ddd8cc", borderRadius:8, padding:"18px 22px", fontFamily:"'Courier New',monospace", fontSize:11.5, whiteSpace:"pre-wrap", lineHeight:1.75, color:"#1a1714" },
  copyBtn: { background:"#f0ebe0", border:"1px solid #ddd8cc", borderRadius:5, padding:"5px 13px", fontSize:10, fontWeight:700, letterSpacing:"0.08em", cursor:"pointer", fontFamily:"Georgia,serif", color:"#6a5a40" },
  tag: { display:"inline-block", background:"#f0ebe0", border:"1px solid #ddd8cc", borderRadius:4, padding:"3px 9px", fontSize:11, color:"#6a5a40", marginRight:6, marginBottom:4 },
};

const badge = (color) => ({ display:"inline-block", background:color+"22", border:`1px solid ${color}44`, borderRadius:3, padding:"1px 7px", fontSize:9, fontWeight:700, letterSpacing:"0.1em", color, textTransform:"uppercase", marginLeft:6 });

// ─── Math ─────────────────────────────────────────────────────────────────────
const fmt = n => "$" + Math.round(n).toLocaleString("en-US");
const toSF = (li, depth) => parseFloat(((li * depth) / 144).toFixed(2));
const applyGrandBuffer = n => Math.ceil(n * (1 + BUFFER) / 50) * 50;

function wallLI(w) {
  const raw = parseFloat(w.inches) || 0;
  if (w.cabType === "uppers" || w.cabType === "lowers") return raw;
  if (w.cabType === "doubleTop") return raw * 3;
  return raw * 2;
}

function calcRoom(room) {
  const cat = getRoomCat(room.type === "Other" ? "" : room.type);
  const config = CAT[cat];
  let wallCabLI = 0, ctWallLI = 0;
  (room.walls || []).forEach(w => { wallCabLI += wallLI(w); if (w.hasCT) ctWallLI += parseFloat(w.inches) || 0; });
  const islandRaw = parseFloat(room.islandLI) || 0;
  const islandCabLI = islandRaw ? (room.islandSides === "both" ? islandRaw * 2 : islandRaw) : 0;
  const islandCTLI = (islandRaw && room.islandHasCT) ? islandRaw : 0;
  const totalCabLI = wallCabLI + islandCabLI;

  // Box material discount
  const boxMat = BOX_MATERIALS.find(m => m.value === (room.boxMaterial || "plywood")) || BOX_MATERIALS[0];
  const boxDiscount = boxMat.discount || 0;

  const closetMat = CLOSET_MATERIALS.find(m => m.value === (room.closetMaterial || "white_melamine")) || CLOSET_MATERIALS[0];
  const closetRate = closetMat.rate;
  const closetMult = room.closetHasDoors ? 3 : 2;
  const rawClosetLI = (room.walls || []).reduce((s, w) => s + (parseFloat(w.inches) || 0), 0);

  let cabinetSubtotal = 0, pricePerLI = 0;
  if (cat === "closet") {
    cabinetSubtotal = rawClosetLI * closetMult * closetRate;
    pricePerLI = closetRate;
  } else {
    // Normalize doorStyle — strip old " — $X/LI" suffix if present from legacy stored values
    const cleanDoorStyle = (room.doorStyle || "").replace(/\s*—\s*\$[\d.]+\/LI.*$/, "").trim();
    const basePricePerLI = config.pricingMode === "tiered"
      ? (CABINET_PRICING[cleanDoorStyle] || CABINET_PRICING[room.doorStyle] || 0)
      : (config.flatRate || 30);
    pricePerLI = basePricePerLI * (1 - boxDiscount);
    cabinetSubtotal = totalCabLI * pricePerLI;
  }

  const ctDepth = parseFloat(room.ctDepthOverride) || config.defaultDepth || 25;
  const ctPricePerSF = parseFloat(room.ctPrice) || DEFAULT_CT_PRICE;
  const ctLI = ctWallLI + islandCTLI;
  const ctSF = toSF(ctLI, ctDepth);
  const ctSubtotal = ctSF * ctPricePerSF;
  const bsHeight = !room.bsOption || room.bsOption === "none" ? 0 : room.bsOption === "4in" ? 4 : room.bsOption === "18in" ? 18 : parseFloat(room.bsCustom) || 0;
  const bsSF = toSF(ctLI, bsHeight);
  const bsSubtotal = bsSF * ctPricePerSF;

  // LED: user enters number of runs, $750/run (overridable)
  const ledRuns = (!room.hasLED || cat === "closet") ? 0 : (parseInt(room.ledRuns) || 0);
  const ledPricePerRun = parseFloat(room.ledPrice) || DEFAULT_LED_PRICE;
  const ledSubtotal = ledRuns * ledPricePerRun;

  // Per-room markup override
  const roomMarkupPct = room.markupOverride !== undefined && room.markupOverride !== "" ? parseFloat(room.markupOverride) : null;
  const roomSubRaw = cabinetSubtotal + ctSubtotal + bsSubtotal + ledSubtotal;
  const roomRaw = roomMarkupPct !== null ? roomSubRaw * (1 + roomMarkupPct / 100) : roomSubRaw;
  const hasCustomMarkup = roomMarkupPct !== null;

  return {
    cat, config, totalCabLI, wallCabLI, islandCabLI, rawClosetLI,
    cabinetSubtotal, ctSF, ctSubtotal, bsSF, bsSubtotal,
    ledRuns, ledSubtotal, ledPricePerRun, roomRaw, roomSubRaw,
    hasCustomMarkup, roomMarkupPct,
    ctDepth, ctPricePerSF, bsHeight,
    pricePerLI, boxDiscount, boxMat,
    closetRate, closetMult, closetMatLabel: closetMat.label,
  };
}

function totalRooms(rooms) {
  // Rooms with custom markup already have it baked into roomRaw
  // Rooms without custom markup contribute to the "needs global buffer" pool
  return (rooms || []).reduce((s, r) => {
    const c = calcRoom(r);
    return {
      raw: s.raw + c.roomSubRaw,           // pre-markup subtotals for global buffer calc
      withMarkup: s.withMarkup + c.roomRaw, // post-markup (custom rooms already applied)
      hasAnyCustom: s.hasAnyCustom || c.hasCustomMarkup,
    };
  }, { raw: 0, withMarkup: 0, hasAnyCustom: false });
}

// ─── Photo Upload + Preview ───────────────────────────────────────────────────
function PhotoUpload({ photos, onChange }) {
  const inputRef = useRef();

  const handleFiles = (e) => {
    const files = Array.from(e.target.files);
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        onChange([...photos, { dataUrl: ev.target.result, name: file.name, type: file.type }]);
      };
      reader.readAsDataURL(file);
    });
    e.target.value = "";
  };

  const remove = (i) => onChange(photos.filter((_, j) => j !== i));

  return (
    <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid #f0ebe0" }}>
      <label style={S.label}>Room Photos</label>
      <div style={S.hint}>Upload photos of the existing space. Claude will analyze them to generate an AI render of the finished design.</div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 10 }}>
        {photos.map((p, i) => (
          <div key={i} style={{ position: "relative", width: 80, height: 80 }}>
            <img src={p.dataUrl} alt={p.name} style={{ width: 80, height: 80, objectFit: "cover", borderRadius: 6, border: "1px solid #ddd8cc" }} />
            <button onClick={() => remove(i)} style={{ position: "absolute", top: -6, right: -6, width: 20, height: 20, borderRadius: "50%", background: "#1a1714", border: "none", color: "#c8a84b", fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1 }}>×</button>
          </div>
        ))}
        <button onClick={() => inputRef.current.click()} style={{ width: 80, height: 80, border: "2px dashed #ddd8cc", borderRadius: 6, background: "#fdfcfa", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4, color: "#9a8a70", fontSize: 10, fontFamily: "Georgia,serif" }}>
          <span style={{ fontSize: 22, lineHeight: 1 }}>+</span>
          <span>Add Photo</span>
        </button>
        <input ref={inputRef} type="file" accept="image/*" multiple style={{ display: "none" }} onChange={handleFiles} />
      </div>
    </div>
  );
}

// ─── Wall Row ─────────────────────────────────────────────────────────────────
function WallRow({ wall, index, onChange, onRemove, isCloset }) {
  return (
    <div style={{ display: "flex", gap: 7, marginBottom: 7, alignItems: "center", flexWrap: "wrap" }}>
      <input style={{ ...S.input, width: 95, flex: "0 0 95px" }} placeholder={`Wall ${index + 1}`} value={wall.label || ""} onChange={e => onChange({ ...wall, label: e.target.value })} />
      <input style={{ ...S.input, width: 72, flex: "0 0 72px" }} type="number" placeholder="Inches" value={wall.inches || ""} onChange={e => onChange({ ...wall, inches: e.target.value })} />
      {!isCloset && (
        <select style={{ ...S.select, width: 152, flex: "0 0 152px" }} value={wall.cabType || "both"} onChange={e => onChange({ ...wall, cabType: e.target.value })}>
          <option value="both">Uppers + Lowers (×2)</option>
          <option value="doubleTop">Double Top (×3)</option>
          <option value="uppers">Uppers Only (×1)</option>
          <option value="lowers">Lowers Only (×1)</option>
        </select>
      )}
      {!isCloset && (
        <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "#6a5a40", cursor: "pointer", whiteSpace: "nowrap" }}>
          <input type="checkbox" checked={wall.hasCT || false} onChange={e => onChange({ ...wall, hasCT: e.target.checked })} />CT
        </label>
      )}
      <button onClick={onRemove} style={{ ...S.btnGhost, padding: "4px 8px", fontSize: 10 }}>×</button>
      {wall.inches && <span style={{ fontSize: 10, color: "#9a8a6a" }}>{isCloset ? `${wall.inches}" raw` : `→ ${wallLI(wall)}" LI`}</span>}
    </div>
  );
}

// ─── Room Form ────────────────────────────────────────────────────────────────
function RoomForm({ room, onChange, index, onRemove }) {
  const addWall = () => onChange({ ...room, walls: [...(room.walls || []), { label: "", inches: "", cabType: "both", hasCT: false }] });
  const updWall = (i, w) => { const walls = [...(room.walls || [])]; walls[i] = w; onChange({ ...room, walls }); };
  const remWall = (i) => onChange({ ...room, walls: room.walls.filter((_, j) => j !== i) });
  const cat = getRoomCat(room.type === "Other" ? "" : room.type);
  const config = CAT[cat];
  const isCloset = cat === "closet";
  const showCT = !isCloset && ((room.walls || []).some(w => w.hasCT) || room.islandHasCT);
  const c = calcRoom(room);
  const photos = room.photos || [];

  return (
    <div style={{ border: `1px solid ${config.color}33`, borderRadius: 8, padding: "18px 20px", marginBottom: 12, background: "#fdfcfa" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 700 }}>Room {index + 1}</span>
          <span style={badge(config.color)}>{config.label}</span>
          {isCloset && <span style={{ fontSize: 10, color: "#6a5a40" }}>×{c.closetMult} × ${c.closetRate}/LI</span>}
          {photos.length > 0 && <span style={{ fontSize: 10, color: "#7a9ebf" }}>📷 {photos.length} photo{photos.length > 1 ? "s" : ""}</span>}
        </div>
        <button onClick={onRemove} style={{ ...S.btnGhost, padding: "3px 9px", fontSize: 10 }}>Remove</button>
      </div>

      <div style={S.row}>
        <div style={S.col}>
          <label style={S.label}>Room Type</label>
          <select style={S.select} value={room.type || ""} onChange={e => onChange({ ...room, type: e.target.value })}>
            <option value="">Select…</option>
            <optgroup label="Cabinets">{["Kitchen", "Bar", "Laundry", "Office"].map(t => <option key={t}>{t}</option>)}</optgroup>
            <optgroup label="Vanity">{["Master Bath", "Bath 2", "Bath 3", "Powder Room"].map(t => <option key={t}>{t}</option>)}</optgroup>
            <optgroup label="Closet">{["Master Closet", "Walk-in Closet", "Reach-in Closet", "Linen Closet"].map(t => <option key={t}>{t}</option>)}</optgroup>
            <optgroup label="Wall Unit / Other">{["Living Room", "Bedroom", "Dining Room", "Wall Unit", "Other"].map(t => <option key={t}>{t}</option>)}</optgroup>
          </select>
          {room.type === "Other" && <input style={{ ...S.input, marginTop: 7 }} placeholder="Custom name" value={room.customType || ""} onChange={e => onChange({ ...room, customType: e.target.value })} />}
        </div>
        {cat === "cabinets" && (
          <div style={S.col}>
            <label style={S.label}>Door Style</label>
              <select style={S.select} value={room.doorStyle || ""} onChange={e => onChange({ ...room, doorStyle: e.target.value })}>
                <option value="">Select…</option>
                {Object.keys(CABINET_PRICING).map(k => <option key={k} value={k}>{k} — ${CABINET_PRICING[k]}/LI</option>)}
              </select>
          </div>
        )}
        {(cat === "vanity" || cat === "wallUnit") && (
          <div style={S.col}>
            <label style={S.label}>Rate</label>
            <div style={{ ...S.input, background: "#f5f2eb", color: "#6a5a40", fontSize: 12 }}>$30 / LI (flat)</div>
          </div>
        )}
        {isCloset && (
          <div style={S.col}>
            <label style={S.label}>Material</label>
            <select style={S.select} value={room.closetMaterial || "white_melamine"} onChange={e => onChange({ ...room, closetMaterial: e.target.value })}>
              {CLOSET_MATERIALS.map(m => <option key={m.value} value={m.value}>{m.label} — ${m.rate}/LI</option>)}
            </select>
          </div>
        )}
      </div>

      {!isCloset && (
        <div>
          <div style={S.row}>
            <div style={S.col}>
              <label style={S.label}>Box Material</label>
              <select style={S.select} value={room.boxMaterial || "plywood"} onChange={e => onChange({ ...room, boxMaterial: e.target.value })}>
                {BOX_MATERIALS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
              {room.boxMaterial === "melamine" && <div style={S.hint}>Melamine box applies a 10% discount to the door style rate.</div>}
            </div>
            <div style={S.col}>
              <label style={S.label}>Door & Drawer Finish</label>
              <select style={S.select} value={room.doorFinish || ""} onChange={e => onChange({ ...room, doorFinish: e.target.value })}>
                <option value="">Select…</option>
                {DOOR_FINISHES.map(f => <option key={f}>{f}</option>)}
              </select>
            </div>
          </div>
          <div style={S.row}>
            <div style={S.col}>
              <label style={S.label}>Hardware</label>
              <input style={S.input} placeholder="e.g. Gola rail, brushed nickel, none" value={room.hardware || ""} onChange={e => onChange({ ...room, hardware: e.target.value })} />
            </div>
            <div style={S.col} />
          </div>
        </div>
      )}

      {isCloset && (
        <div style={{ ...S.row, marginBottom: 14 }}>
          <div style={S.col}>
            <label style={S.label}>Has Doors?</label>
            <select style={S.select} value={room.closetHasDoors ? "yes" : "no"} onChange={e => onChange({ ...room, closetHasDoors: e.target.value === "yes" })}>
              <option value="no">No doors — LI × 2 × ${(CLOSET_MATERIALS.find(m => m.value === (room.closetMaterial || "white_melamine")) || CLOSET_MATERIALS[0]).rate}</option>
              <option value="yes">Has doors — LI × 3 × ${(CLOSET_MATERIALS.find(m => m.value === (room.closetMaterial || "white_melamine")) || CLOSET_MATERIALS[0]).rate}</option>
            </select>
          </div>
          <div style={S.col} />
        </div>
      )}

      <label style={{ ...S.label, marginBottom: 5 }}>Walls</label>
      <div style={S.hint}>{isCloset ? "Enter raw LI per wall." : "Raw inches per wall. Uppers+Lowers (×2), Double Top (×3), Uppers Only (×1), Lowers Only (×1). Check CT for countertop walls."}</div>
      <div style={{ marginTop: 10 }}>
        {(room.walls || []).map((w, i) => <WallRow key={i} wall={w} index={i} isCloset={isCloset} onChange={w => updWall(i, w)} onRemove={() => remWall(i)} />)}
        <button onClick={addWall} style={{ ...S.btnGhost, fontSize: 10, marginTop: 4 }}>+ Add Wall</button>
      </div>

      {cat === "cabinets" && (
        <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid #f0ebe0" }}>
          <label style={S.label}>Island</label>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <input style={{ ...S.input, width: 100, flex: "0 0 100px" }} type="number" placeholder="Linear inches" value={room.islandLI || ""} onChange={e => onChange({ ...room, islandLI: e.target.value })} />
            <select style={{ ...S.select, width: 174, flex: "0 0 174px" }} value={room.islandSides || "one"} onChange={e => onChange({ ...room, islandSides: e.target.value })}>
              <option value="one">Cabinets one side (×1)</option>
              <option value="both">Cabinets both sides (×2)</option>
            </select>
            <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "#6a5a40", cursor: "pointer" }}>
              <input type="checkbox" checked={room.islandHasCT || false} onChange={e => onChange({ ...room, islandHasCT: e.target.checked })} />Island CT
            </label>
            {room.islandLI && <span style={{ fontSize: 10, color: "#9a8a6a" }}>= {room.islandSides === "both" ? parseFloat(room.islandLI) * 2 : parseFloat(room.islandLI)}" LI</span>}
          </div>
        </div>
      )}

      {showCT && (
        <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid #f0ebe0" }}>
          <div style={S.row}>
            <div style={S.col}>
              <label style={S.label}>CT Depth Override (inches)</label>
              <input style={S.input} type="number" placeholder={`Default: ${config.defaultDepth || 25}"`} value={room.ctDepthOverride || ""} onChange={e => onChange({ ...room, ctDepthOverride: e.target.value })} />
            </div>
            <div style={S.col}>
              <label style={S.label}>CT Price / SF ($)</label>
              <input style={S.input} type="number" placeholder={`${DEFAULT_CT_PRICE}`} value={room.ctPrice || ""} onChange={e => onChange({ ...room, ctPrice: e.target.value })} />
            </div>
          </div>
          <div style={S.row}>
            <div style={S.col}>
              <label style={S.label}>Backsplash Height</label>
              <select style={S.select} value={room.bsOption || "none"} onChange={e => onChange({ ...room, bsOption: e.target.value })}>
                <option value="none">No backsplash</option>
                <option value="4in">4" standard</option>
                <option value="18in">18"</option>
                <option value="custom">Custom</option>
              </select>
              {room.bsOption === "custom" && <input style={{ ...S.input, marginTop: 7 }} type="number" placeholder="Height in inches" value={room.bsCustom || ""} onChange={e => onChange({ ...room, bsCustom: e.target.value })} />}
            </div>
            <div style={S.col} />
          </div>
        </div>
      )}

      {!isCloset && (
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid #f0ebe0" }}>
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#6a5a40", cursor: "pointer", marginBottom: 8 }}>
            <input type="checkbox" checked={room.hasLED || false} onChange={e => onChange({ ...room, hasLED: e.target.checked })} />
            LED Lighting Upgrade
          </label>
          {room.hasLED && (
            <div style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
              <div>
                <label style={S.label}>Number of Runs</label>
                <input style={{ ...S.input, width: 90 }} type="number" min="1" placeholder="1"
                  value={room.ledRuns || ""} onChange={e => onChange({ ...room, ledRuns: e.target.value })} />
              </div>
              <div>
                <label style={S.label}>Price / Run ($)</label>
                <input style={{ ...S.input, width: 100 }} type="number" placeholder={`${DEFAULT_LED_PRICE}`}
                  value={room.ledPrice || ""} onChange={e => onChange({ ...room, ledPrice: e.target.value })} />
              </div>
              {c.ledRuns > 0 && (
                <span style={{ fontSize: 11, color: "#8a6a20", paddingBottom: 9 }}>
                  {c.ledRuns} × ${c.ledPricePerRun} = {fmt(c.ledSubtotal)}
                </span>
              )}
            </div>
          )}
        </div>
      )}

      <div style={{ marginTop: 12, display: "flex", gap: 12 }}>
        <div style={{ width: 140, flexShrink: 0 }}>
          <label style={S.label}>Markup Override (%)</label>
          <input style={S.input} type="number" placeholder="Blank = global 15%"
            value={room.markupOverride !== undefined && room.markupOverride !== "" ? room.markupOverride : ""}
            onChange={e => onChange({ ...room, markupOverride: e.target.value === "" ? "" : e.target.value })} />
          <div style={S.hint}>Only set if different from 15%.</div>
        </div>
        <div style={{ flex: 1 }}>
          <label style={S.label}>Notes / Field Measure Flags</label>
          <input style={S.input} placeholder="Corner cab, tall pantry, fridge surround, unspecified dims…"
            value={room.notes || ""} onChange={e => onChange({ ...room, notes: e.target.value })} />
        </div>
      </div>

      <div style={{ marginTop: 10 }}>
        <label style={S.label}>Notes to Client</label>
        <input style={S.input} placeholder="e.g. Lead time 6–8 weeks, custom color match, field measure required before order…"
          value={room.clientNotes || ""} onChange={e => onChange({ ...room, clientNotes: e.target.value })} />
        <div style={S.hint}>Appears in client proposal and internal breakdown.</div>
      </div>

      {/* Photo upload */}
      <PhotoUpload photos={photos} onChange={p => onChange({ ...room, photos: p })} />

      <div style={{ marginTop: 12, background: c.roomRaw > 0 ? "#f7f3ea" : "#faf8f4", borderRadius: 6, padding: "9px 14px", fontSize: 11, color: "#6a5040", display: "flex", gap: 14, flexWrap: "wrap", alignItems: "center", border: "1px solid #ede8dc" }}>
        {!isCloset && <span>LI: <strong>{c.totalCabLI}"</strong></span>}
        {isCloset && <span>Raw LI: <strong>{c.rawClosetLI}"</strong></span>}
        {!isCloset && c.pricePerLI > 0 && <span style={{ fontSize: 10, color: "#9a8a6a" }}>@ ${c.pricePerLI.toFixed(2)}/LI{c.boxDiscount > 0 ? " (−10% melamine)" : ""}</span>}
        <span>{config.label}: <strong>{c.cabinetSubtotal > 0 ? fmt(c.cabinetSubtotal) : "—"}</strong></span>
        {c.ctSF > 0 && <span>CT {c.ctSF}SF: <strong>{fmt(c.ctSubtotal)}</strong></span>}
        {c.bsSF > 0 && <span>BS {c.bsSF}SF: <strong>{fmt(c.bsSubtotal)}</strong></span>}
        {c.ledSubtotal > 0 && <span>LED: <strong>{fmt(c.ledSubtotal)}</strong></span>}
        {c.hasCustomMarkup && <span style={{ background: "#e8f4e8", border: "1px solid #a8d4a8", borderRadius: 3, padding: "1px 6px", fontSize: 9, fontWeight: 700, color: "#2a7a4a" }}>Markup: {c.roomMarkupPct}%</span>}
        <span style={{ marginLeft: "auto", fontWeight: 700, color: c.roomRaw > 0 ? "#8a6020" : "#aaa" }}>
          {c.roomRaw > 0 ? `Room raw: ${fmt(c.roomSubRaw)}` : "Enter walls to see total"}
        </span>
      </div>
    </div>
  );
}

// ─── Unit Form ────────────────────────────────────────────────────────────────
function UnitForm({ unit, onChange, index, onRemove }) {
  const addRoom = () => onChange({ ...unit, rooms: [...(unit.rooms || []), { walls: [] }] });
  const updRoom = (i, r) => { const rooms = [...unit.rooms]; rooms[i] = r; onChange({ ...unit, rooms }); };
  const remRoom = (i) => onChange({ ...unit, rooms: unit.rooms.filter((_, j) => j !== i) });
  const tot = totalRooms(unit.rooms || []);
  return (
    <div style={{ border: "1px solid #c8a84b55", borderRadius: 10, padding: "20px 22px", marginBottom: 16, background: "#fffdf7" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 13, fontWeight: 700 }}>Unit Type {index + 1}</span>
          {tot.raw > 0 && <span style={{ fontSize: 11, color: "#8a6a20" }}>raw/unit: {fmt(tot.raw)}</span>}
        </div>
        <button onClick={onRemove} style={{ ...S.btnGhost, fontSize: 10 }}>Remove</button>
      </div>
      <div style={S.row}>
        <div style={S.col}>
          <label style={S.label}>Unit Type Name</label>
          <input style={S.input} placeholder="e.g. 2BD/2BA, Type A, Penthouse" value={unit.name || ""} onChange={e => onChange({ ...unit, name: e.target.value })} />
        </div>
        <div style={{ width: 110 }}>
          <label style={S.label}>Quantity</label>
          <input style={S.input} type="number" min="1" placeholder="1" value={unit.qty || ""} onChange={e => onChange({ ...unit, qty: e.target.value })} />
        </div>
      </div>
      {(unit.rooms || []).map((r, i) => <RoomForm key={i} room={r} index={i} onChange={r => updRoom(i, r)} onRemove={() => remRoom(i)} />)}
      <button onClick={addRoom} style={S.btnGhost}>+ Add Room</button>
    </div>
  );
}

// ─── Output Builders ──────────────────────────────────────────────────────────
function buildClientText(job) {
  const isMulti = job.jobType === "multi";
  let lines = [], item = 1;
  const rev = job.revision || 1;
  lines.push("PROPOSAL" + (rev > 1 ? ` — Rev ${rev}` : ""));
  lines.push(job.clientName || ""); lines.push(job.address || "");
  lines.push("Prepared by Acacia Kitchen Cabinets");
  lines.push(`Date: ${new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`);
  lines.push("");

  let customTotal = 0, globalRaw = 0;
  const clientNotesByRoom = [];

  const processUnit = (unit, qty) => {
    if (isMulti) lines.push(`UNIT TYPE: ${unit.name || "Unit"} (×${qty})`);
    (unit.rooms || []).forEach(r => {
      const name = r.type === "Other" ? (r.customType || "Other") : (r.type || "Room");
      const c = calcRoom(r);
      if (c.hasCustomMarkup) customTotal += c.roomRaw * qty;
      else globalRaw += c.roomSubRaw * qty;
      lines.push(`  ${item++}. ${name} – ${CAT[c.cat].label} & Millwork`);
      if (c.ctSF > 0) lines.push(`  ${item++}. ${name} – Countertop Fabrication & Installation`);
      if (c.bsSF > 0) lines.push(`  ${item++}. ${name} – Backsplash Fabrication & Installation`);
      if (c.ledSubtotal > 0) lines.push(`  ${item++}. ${name} – LED Lighting`);
      if (r.clientNotes) clientNotesByRoom.push({ name, note: r.clientNotes });
    });
    if (isMulti) lines.push("");
  };

  if (isMulti) (job.units || []).forEach(u => processUnit(u, parseInt(u.qty) || 1));
  else processUnit({ rooms: job.rooms || [] }, 1);

  const cabBuf = customTotal + applyGrandBuffer(globalRaw);
  const demoAmt = job.includeDemo ? (parseFloat(job.demoPrice) || DEFAULT_DEMO_PRICE) : 0;
  const installPct = job.includeInstall ? (parseFloat(job.installPct) ?? DEFAULT_INSTALL_PCT) : 0;
  const installAmt = job.includeInstall ? Math.ceil((cabBuf * installPct / 100) / 50) * 50 : 0;
  const grandTotal = cabBuf + demoAmt + installAmt;

  if (demoAmt > 0) lines.push(`  ${item++}. Demolition & Removal`);
  if (installAmt > 0) lines.push(`  ${item++}. Delivery & Installation`);

  lines.push("─".repeat(44)); lines.push(`TOTAL: ${fmt(grandTotal)}`); lines.push("");

  // Client notes per room
  if (clientNotesByRoom.length > 0) {
    lines.push("PROJECT NOTES");
    clientNotesByRoom.forEach(({ name, note }) => lines.push(`  ${name}: ${note}`));
    lines.push("");
  }

  if (job.clientNotes) { lines.push("ADDITIONAL NOTES"); lines.push(job.clientNotes); lines.push(""); }

  lines.push("NOTES"); lines.push(`Box construction: 3/4" plywood`);
  if (job.finishNotes) lines.push(`Finishes: ${job.finishNotes}`);
  if (job.ctMaterial) lines.push(`Countertop material: ${job.ctMaterial}`);
  lines.push("Edge profile: Eased"); lines.push("");
  lines.push("EXCLUSIONS"); lines.push("Backsplash tile/material supply, hardware (unless noted), appliances,"); lines.push("closet systems (unless specified above), plumbing, sinks.");
  if (job.exclusionNotes) lines.push(job.exclusionNotes);
  return lines.join("\n");
}

function buildInternalText(job) {
  const isMulti = job.jobType === "multi";
  let lines = [], customTotal = 0, globalRaw = 0;
  const rev = job.revision || 1;
  lines.push(`INTERNAL ESTIMATE — ${(job.clientName || "").toUpperCase()}${rev > 1 ? `  [Rev ${rev}]` : ""}`);
  lines.push(`Address  : ${job.address || "—"}`);
  lines.push(`Date     : ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`);
  lines.push(`Buffer   : 15% global (rooms with markup override use their own %)`);
  lines.push("═".repeat(58)); lines.push("");

  const processUnit = (unit, qty) => {
    if (isMulti) lines.push(`▶ UNIT: ${unit.name || "Unit"}  ×${qty}`);
    (unit.rooms || []).forEach(r => {
      const c = calcRoom(r);
      const name = r.type === "Other" ? (r.customType || "Other") : (r.type || "Room");
      const markupLabel = c.hasCustomMarkup ? ` [MARKUP: ${c.roomMarkupPct}%]` : " [global 15%]";
      lines.push(`  ${name}  [${CAT[c.cat].label}]${markupLabel}`);
      if (c.cat === "closet") {
        lines.push(`    Material: ${c.closetMatLabel}  Has doors: ${r.closetHasDoors ? "Yes" : "No"}  Rate: $${c.closetRate}/LI  ×${c.closetMult}`);
        (r.walls || []).forEach(w => lines.push(`      "${w.label || "Wall"}": ${w.inches || 0}" raw`));
        lines.push(`    → ${c.rawClosetLI}" × ${c.closetMult} × $${c.closetRate} = ${fmt(c.cabinetSubtotal)}  (×${qty} = ${fmt(c.cabinetSubtotal * qty)})`);
      } else {
        const typeMap = { both: "U+L ×2", doubleTop: "DblTop ×3", uppers: "Uppers ×1", lowers: "Lowers ×1" };
        if (r.doorStyle) lines.push(`    Style: ${r.doorStyle} @ $${c.pricePerLI.toFixed(2)}/LI${c.boxDiscount > 0 ? ` (${(c.boxDiscount*100).toFixed(0)}% melamine discount applied)` : ""}`);
        if (r.boxMaterial) lines.push(`    Box: ${c.boxMat.label}  Finish: ${r.doorFinish || "—"}  Hardware: ${r.hardware || "—"}`);
        (r.walls || []).forEach(w => lines.push(`      "${w.label || "Wall"}": ${w.inches || 0}" → ${wallLI(w)}" LI [${typeMap[w.cabType || "both"]}]${w.hasCT ? " ✓CT" : ""}`));
        if (r.islandLI) { const ili = r.islandSides === "both" ? parseFloat(r.islandLI) * 2 : parseFloat(r.islandLI); lines.push(`      Island: ${r.islandLI}" → ${ili}" LI${r.islandHasCT ? " ✓CT" : ""}`); }
        lines.push(`    → Total LI: ${c.totalCabLI}" × $${c.pricePerLI} = ${fmt(c.cabinetSubtotal)}  (×${qty} = ${fmt(c.cabinetSubtotal * qty)})`);
        if (c.ctSF > 0) lines.push(`    → CT: ${c.ctSF}SF (${c.ctDepth}") × $${c.ctPricePerSF} = ${fmt(c.ctSubtotal)}  (×${qty} = ${fmt(c.ctSubtotal * qty)})`);
        if (c.bsSF > 0) lines.push(`    → BS: ${c.bsSF}SF (${c.bsHeight}") × $${c.ctPricePerSF} = ${fmt(c.bsSubtotal)}  (×${qty} = ${fmt(c.bsSubtotal * qty)})`);
        if (c.ledSubtotal > 0) lines.push(`    → LED: ${c.ledRuns} runs × $${c.ledPricePerRun} = ${fmt(c.ledSubtotal)}  (×${qty} = ${fmt(c.ledSubtotal * qty)})`);
      }
      if (c.hasCustomMarkup) {
        lines.push(`    → Sub-raw: ${fmt(c.roomSubRaw)} + ${c.roomMarkupPct}% = ${fmt(c.roomRaw)}  (×${qty} = ${fmt(c.roomRaw * qty)})`);
        customTotal += c.roomRaw * qty;
      } else {
        globalRaw += c.roomSubRaw * qty;
        lines.push(`    Room sub-raw: ${fmt(c.roomSubRaw)}  (×${qty} = ${fmt(c.roomSubRaw * qty)}) → global buffer applies`);
      }
      if ((r.photos || []).length > 0) lines.push(`    📷 ${r.photos.length} photo(s) attached`);
      if (r.notes) lines.push(`    ⚑ Field: ${r.notes}`);
      if (r.clientNotes) lines.push(`    💬 Client note: ${r.clientNotes}`);
      lines.push("");
    });
    const unitCustom = (unit.rooms || []).filter(r => calcRoom(r).hasCustomMarkup).reduce((s, r) => s + calcRoom(r).roomRaw, 0);
    const unitGlobalRaw = (unit.rooms || []).filter(r => !calcRoom(r).hasCustomMarkup).reduce((s, r) => s + calcRoom(r).roomSubRaw, 0);
    lines.push(`  Unit total (pre-global-buffer): ${fmt((unitCustom + unitGlobalRaw) * (parseInt(unit.qty) || 1))}`);
    lines.push("─".repeat(58)); lines.push("");
  };

  if (isMulti) (job.units || []).forEach(u => processUnit(u, parseInt(u.qty) || 1));
  else processUnit({ rooms: job.rooms || [] }, 1);

  const cabBuf = customTotal + applyGrandBuffer(globalRaw);
  const demoAmt = job.includeDemo ? (parseFloat(job.demoPrice) || DEFAULT_DEMO_PRICE) : 0;
  const installPct = job.includeInstall ? (parseFloat(job.installPct) ?? DEFAULT_INSTALL_PCT) : 0;
  const installAmt = job.includeInstall ? Math.ceil((cabBuf * installPct / 100) / 50) * 50 : 0;
  const grandTotal = cabBuf + demoAmt + installAmt;

  lines.push(`CUSTOM MARKUP ROOMS TOTAL: ${fmt(customTotal)}`);
  lines.push(`GLOBAL BUFFER ROOMS RAW  : ${fmt(globalRaw)}  → +15% = ${fmt(applyGrandBuffer(globalRaw))}`);
  lines.push(`CABINETS COMBINED        : ${fmt(cabBuf)}`);
  if (demoAmt > 0)    lines.push(`DEMOLITION               : ${fmt(demoAmt)} (flat fee)`);
  if (installAmt > 0) lines.push(`DELIVERY & INSTALLATION  : ${fmt(installAmt)} (${installPct}% of ${fmt(cabBuf)})`);
  lines.push("─".repeat(58));
  lines.push(`GRAND TOTAL              : ${fmt(grandTotal)}`);
  lines.push(`Revision                 : Rev ${rev}`);
  lines.push("");
  if (job.ctMaterial) lines.push(`CT material    : ${job.ctMaterial}`);
  if (job.finishNotes) lines.push(`Finishes       : ${job.finishNotes}`);
  if (job.clientNotes) lines.push(`Client notes   : ${job.clientNotes}`);
  if (job.internalNotes) lines.push(`Internal notes : ${job.internalNotes}`);
  return lines.join("\n");
}

// ─── Render Gallery ───────────────────────────────────────────────────────────
function RenderGallery({ renders }) {
  if (!renders || renders.length === 0) return null;
  return (
    <div style={{ marginTop: 24 }}>
      <div style={{ ...S.label, marginBottom: 12 }}>AI Renders</div>
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        {renders.map((r, i) => (
          <div key={i} style={{ flex: "1 1 280px", minWidth: 240 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#6a5a40", marginBottom: 6, letterSpacing: "0.06em" }}>{r.roomName}</div>
            {r.loading && (
              <div style={{ width: "100%", height: 200, background: "#f0ebe0", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, fontSize: 12, color: "#9a8a70" }}>
                <div style={{ width: 16, height: 16, border: "2px solid #c8a84b", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                Generating render…
              </div>
            )}
            {r.error && <div style={{ padding: "12px", background: "#fff0ee", border: "1px solid #f0c0b0", borderRadius: 8, fontSize: 11, color: "#a05040" }}>{r.error}</div>}
            {r.url && (
              <div>
                <img src={r.url} alt={r.roomName} style={{ width: "100%", borderRadius: 8, border: "1px solid #e8e2d8", display: "block" }} />
                <a href={r.url} download={`${r.roomName}-render.png`} style={{ display: "inline-block", marginTop: 6, fontSize: 10, color: "#8a7a60", textDecoration: "underline" }}>Download</a>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function AcaciaEstimator({ injectedAnthropicKey = "" }) {
  const [step, setStep] = useState(0);
  const [job, setJob] = useState({ jobType: "single", rooms: [{ walls: [] }], units: [{ name: "", qty: 1, rooms: [{ walls: [] }] }] });
  const [openaiKey, setOpenaiKey] = useState(import.meta.env.VITE_OPENAI_API_KEY || "");
  const anthropicKey = injectedAnthropicKey;
  const [loading, setLoading] = useState(false);
  const [clientOut, setClientOut] = useState("");
  const [internalOut, setInternalOut] = useState("");
  const [renders, setRenders] = useState([]);
  const [activeTab, setActiveTab] = useState("client");
  const [copied, setCopied] = useState("");
  const [activeEstimateId, setActiveEstimateId] = useState(null);
  const [saveStatus, setSaveStatus] = useState({ type: "", msg: "" });

  const sf = (k, v) => setJob(j => ({ ...j, [k]: v }));
  const addRoom = () => setJob(j => ({ ...j, rooms: [...j.rooms, { walls: [] }] }));
  const updRoom = (i, r) => setJob(j => { const rooms = [...j.rooms]; rooms[i] = r; return { ...j, rooms }; });
  const remRoom = (i) => setJob(j => ({ ...j, rooms: j.rooms.filter((_, k) => k !== i) }));
  const addUnit = () => setJob(j => ({ ...j, units: [...j.units, { name: "", qty: 1, rooms: [{ walls: [] }] }] }));
  const updUnit = (i, u) => setJob(j => { const units = [...j.units]; units[i] = u; return { ...j, units }; });
  const remUnit = (i) => setJob(j => ({ ...j, units: j.units.filter((_, k) => k !== i) }));

  const grandRawPreview = (() => {
    const units = job.jobType === "multi" ? job.units : [{ rooms: job.rooms, qty: 1 }];
    let customTotal = 0, globalRaw = 0;
    units.forEach(u => {
      const qty = parseInt(u.qty) || 1;
      (u.rooms || []).forEach(r => {
        const c = calcRoom(r);
        if (c.hasCustomMarkup) customTotal += (c.roomRaw || 0) * qty;
        else globalRaw += (c.roomSubRaw || 0) * qty;
      });
    });
    return { customTotal: customTotal || 0, globalRaw: globalRaw || 0, combined: (customTotal + globalRaw) || 0 };
  })();

  const cabBufPreview = grandRawPreview.customTotal + applyGrandBuffer(grandRawPreview.globalRaw);
  const demoPreview = job.includeDemo ? (parseFloat(job.demoPrice) || DEFAULT_DEMO_PRICE) : 0;
  const installPctPreview = job.includeInstall ? (parseFloat(job.installPct) || DEFAULT_INSTALL_PCT) : 0;
  const installPreview = job.includeInstall ? Math.ceil((cabBufPreview * installPctPreview / 100) / 50) * 50 : 0;
  const grandTotalPreview = (isNaN(cabBufPreview) ? 0 : cabBufPreview) + demoPreview + (isNaN(installPreview) ? 0 : installPreview);

  // Get all rooms across the whole job that have photos
  const allRoomsWithPhotos = (() => {
    if (job.jobType === "single") {
      return (job.rooms || []).filter(r => (r.photos || []).length > 0).map(r => ({ room: r, unitName: null }));
    } else {
      const results = [];
      (job.units || []).forEach(u => {
        (u.rooms || []).filter(r => (r.photos || []).length > 0).forEach(r => results.push({ room: r, unitName: u.name }));
      });
      return results;
    }
  })();

  // Analyze a photo with Claude vision to get a description of the space
  const analyzePhoto = async (photoDataUrl, room) => {
    const base64 = photoDataUrl.split(",")[1];
    const mediaType = photoDataUrl.split(";")[0].split(":")[1];
    const headers = { "Content-Type": "application/json", "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" };
    if (anthropicKey) headers["x-api-key"] = anthropicKey;
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 400,
        messages: [{
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } },
            { type: "text", text: `You are helping generate an AI render prompt for a kitchen/bath cabinet design company. Analyze this photo and describe: 1) Room dimensions and layout (shape, ceiling height if visible, window placement) 2) Existing finishes and materials 3) Lighting conditions. Be concise and factual. This will be used to generate a photorealistic render showing new ${room.doorStyle || "custom"} cabinets in ${room.material || "painted wood"}.` }
          ]
        }]
      })
    });
    const data = await res.json();
    return data.content?.find(b => b.type === "text")?.text || "";
  };

  // Generate a DALL-E render
  const generateRender = async (room, unitName) => {
    const roomName = (room.type === "Other" ? room.customType : room.type) || "Room";
    const fullName = unitName ? `${unitName} – ${roomName}` : roomName;

    // Analyze first photo with Claude if available
    let spaceDesc = "";
    if ((room.photos || []).length > 0) {
      try { spaceDesc = await analyzePhoto(room.photos[0].dataUrl, room); } catch (e) { spaceDesc = ""; }
    }

    const doorStyle = room.doorStyle || "flat panel";
    const material = room.material || "painted wood";
    const hardware = room.hardware || "minimal hardware";
    const hasIsland = room.islandLI > 0;
    const hasLED = room.hasLED;
    const ctMaterial = room.ctMaterial || "quartz countertop";

    const prompt = `Photorealistic interior design render of a luxury ${roomName.toLowerCase()} with custom ${doorStyle} cabinets in ${material} finish. ${hardware !== "none" ? `Hardware: ${hardware}.` : ""} ${hasIsland ? "Large kitchen island." : ""} ${ctMaterial} countertops with eased edge profile. ${hasLED ? "Under-cabinet LED lighting." : ""} High-end residential, professional photography, 8K, natural light, clean and elegant. ${spaceDesc ? `Room context: ${spaceDesc}` : ""}`.slice(0, 1000);

    const res = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${openaiKey}` },
      body: JSON.stringify({ model: "dall-e-3", prompt, n: 1, size: "1792x1024", quality: "standard" })
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error.message);
    return { roomName: fullName, url: data.data[0].url };
  };

  const generate = async () => {
    // Increment revision number
    const newRevision = (job.revision || 0) + 1;
    const updatedJob = { ...job, revision: newRevision };
    setJob(updatedJob);

    setLoading(true);
    setStep(3);
    setRenders([]);

    // Build text outputs
    const rawClient = buildClientText(updatedJob);
    setInternalOut(buildInternalText(updatedJob));

    // Polish client proposal with Claude
    let polishedClient = rawClient;
    try {
      const headers = { "Content-Type": "application/json", "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" };
      if (anthropicKey) headers["x-api-key"] = anthropicKey;
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST", headers,
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514", max_tokens: 1000,
          system: `You are an estimating assistant for Acacia Kitchen Cabinets. Polish this cabinet proposal into a clean, professional client-facing document. CRITICAL: You must preserve the EXACT dollar amount from the TOTAL line — never change, remove, or replace it with placeholder text. Keep client name and address in header. Single total price only, no buffer mentioned, no per-room prices. Scope by room with numbered items. If room-level client notes exist, include them under a "Project Notes" section. Standard exclusions at bottom. Return only the proposal text.`,
          messages: [{ role: "user", content: rawClient }],
        }),
      });
      const data = await res.json();
      polishedClient = data.content?.find(b => b.type === "text")?.text || rawClient;
    } catch { polishedClient = rawClient; }
    setClientOut(polishedClient);
    setLoading(false);

    // Auto-save to Google Drive history
    try {
      setSaveStatus({ type: "saving", msg: "Saving to history…" });
      const safeName = (updatedJob.clientName || "Estimate").replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_');
      const dateStr = new Date().toISOString().slice(0, 10);
      const fileName = `Acacia_${safeName}_${dateStr}_Rev${newRevision}.json`;
      // Strip photos from saved data (too large) but keep metadata
      const saveData = {
        ...updatedJob,
        rooms: (updatedJob.rooms || []).map(r => ({ ...r, photos: (r.photos || []).map(p => ({ name: p.name, type: p.type })) })),
        units: (updatedJob.units || []).map(u => ({ ...u, rooms: (u.rooms || []).map(r => ({ ...r, photos: (r.photos || []).map(p => ({ name: p.name, type: p.type })) })) })),
        savedAt: new Date().toISOString(),
        clientOut: polishedClient,
        internalOut: buildInternalText(updatedJob),
      };
      const res = await fetch("/api/history", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "save", fileName, data: saveData }),
      });
      const data = await res.json();
      if (data.fileId) { setActiveEstimateId(data.fileId); setSaveStatus({ type: "saved", msg: `Rev ${newRevision} saved to Drive` }); }
      else setSaveStatus({ type: "error", msg: "Drive save failed" });
    } catch (e) { setSaveStatus({ type: "error", msg: "Drive save failed: " + e.message }); }

    // Generate renders for rooms with photos (if OpenAI key provided)
    if (openaiKey && allRoomsWithPhotos.length > 0) {
      const initialRenders = allRoomsWithPhotos.map(({ room, unitName }) => ({
        roomName: (unitName ? `${unitName} – ` : "") + ((room.type === "Other" ? room.customType : room.type) || "Room"),
        loading: true, url: null, error: null,
      }));
      setRenders(initialRenders);
      allRoomsWithPhotos.forEach(async ({ room, unitName }, i) => {
        try {
          const result = await generateRender(room, unitName);
          setRenders(prev => { const next = [...prev]; next[i] = { ...result, loading: false, error: null }; return next; });
        } catch (e) {
          setRenders(prev => { const next = [...prev]; next[i] = { roomName: next[i].roomName, loading: false, url: null, error: `Render failed: ${e.message}` }; return next; });
        }
      });
    }
  };

  const copy = (text, key) => { navigator.clipboard.writeText(text); setCopied(key); setTimeout(() => setCopied(""), 2000); };
  const reset = () => { setStep(0); setJob({ jobType: "single", rooms: [{ walls: [] }], units: [{ name: "", qty: 1, rooms: [{ walls: [] }] }] }); setClientOut(""); setInternalOut(""); setRenders([]); };

  return (
    <div style={S.app}>
      <style>{`input:focus,select:focus{border-color:#c8a84b!important;box-shadow:0 0 0 3px #c8a84b22}@keyframes spin{to{transform:rotate(360deg)}}*{box-sizing:border-box;margin:0;padding:0}`}</style>

      <EstimateHistory
        currentJob={job}
        onLoad={(data) => { setJob(data); setStep(0); }}
        activeEstimateId={activeEstimateId}
        setActiveEstimateId={setActiveEstimateId}
      />

      <div style={S.header}>
        <div style={S.logo}>A</div>
        <div>
          <div style={S.logoText}>Acacia Estimating Tool</div>
          <div style={S.logoSub}>INTERNAL USE ONLY · v6</div>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 16 }}>
          {["Project", "Rooms", "Review", "Output"].map((l, i) => (
            <span key={i} style={{ fontSize: 10, letterSpacing: "0.08em", color: i === step ? "#c8a84b" : i < step ? "#6a5a30" : "#3a3020", fontWeight: i === step ? 700 : 400 }}>
              {i < step ? "✓ " : ""}{l}
            </span>
          ))}
        </div>
      </div>

      <div style={S.wrap}>

        {/* STEP 0 */}
        {step === 0 && (
          <div style={S.card}>
            <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 3 }}>New Estimate</div>
            <div style={{ fontSize: 12, color: "#8a7a60", marginBottom: 22 }}>Project details first</div>
            <div style={S.row}><div style={S.col}><label style={S.label}>Client / Project Name</label><input style={S.input} placeholder="e.g. Smith Residence / Arki Construction" value={job.clientName || ""} onChange={e => sf("clientName", e.target.value)} /></div></div>
            <div style={S.row}><div style={S.col}><label style={S.label}>Address</label><input style={S.input} placeholder="e.g. 1900 SW 32nd Ave, Miami, FL 33145" value={job.address || ""} onChange={e => sf("address", e.target.value)} onBlur={e => {
              // Auto-format: capitalize words, ensure City, ST ZIPCODE pattern
              let v = e.target.value.trim();
              // Title-case each word except state abbreviations
              v = v.replace(/\w+/g, w => w.length === 2 && /[A-Z]{2}/.test(w.toUpperCase()) ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
              // Ensure ZIP stays uppercase/numeric
              v = v.replace(/(\d{5})(-\d{4})?/, m => m);
              sf("address", v);
            }} /></div></div>
            <div style={S.row}>
              <div style={S.col}><label style={S.label}>Job Type</label><select style={S.select} value={job.jobType} onChange={e => sf("jobType", e.target.value)}><option value="single">Single Residential Home</option><option value="multi">Multi-Unit / Developer Project</option></select></div>
              <div style={S.col}><label style={S.label}>Countertop Material</label><input style={S.input} placeholder="e.g. Crystal White Quartz, TBD" value={job.ctMaterial || ""} onChange={e => sf("ctMaterial", e.target.value)} /></div>
            </div>
            <div style={S.row}>
              <div style={S.col}><label style={S.label}>Finish / Spec Notes</label><input style={S.input} placeholder="Per architect schedule, painted maple, etc." value={job.finishNotes || ""} onChange={e => sf("finishNotes", e.target.value)} /></div>
              <div style={S.col}><label style={S.label}>Internal Notes</label><input style={S.input} placeholder="GC contact, lead source, conditions" value={job.internalNotes || ""} onChange={e => sf("internalNotes", e.target.value)} /></div>
            </div>
            <div style={S.row}><div style={S.col}><label style={S.label}>Additional Exclusions</label><input style={S.input} placeholder="Project-specific exclusions" value={job.exclusionNotes || ""} onChange={e => sf("exclusionNotes", e.target.value)} /></div></div>
            <div style={S.row}><div style={S.col}>
              <label style={S.label}>Notes to Client (project-level)</label>
              <input style={S.input} placeholder="e.g. Payment terms, lead time, special conditions visible to client…"
                value={job.clientNotes || ""} onChange={e => sf("clientNotes", e.target.value)} />
            </div></div>

            {/* OpenAI key */}
            <div style={{ marginTop: 4, paddingTop: 18, borderTop: "1px solid #f0ebe0" }}>
              <label style={S.label}>OpenAI API Key <span style={{ color: "#b0a090", fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>(for AI renders)</span></label>
              {import.meta.env.VITE_OPENAI_API_KEY
                ? <div style={{ ...S.input, background: "#f0faf4", color: "#2a7a4a", fontSize: 12 }}>✓ Auto-loaded from environment</div>
                : <input style={{ ...S.input, fontFamily: "monospace", letterSpacing: "0.04em" }} type="password" placeholder="sk-…" value={openaiKey} onChange={e => setOpenaiKey(e.target.value)} />
              }
              <div style={S.hint}>Key is used only for DALL-E renders. Never stored or logged.</div>
            </div>

            <div style={{ marginTop: 20 }}><button style={S.btnGold} onClick={() => setStep(1)}>Next: Enter Rooms →</button></div>
          </div>
        )}

        {/* STEP 1 */}
        {step === 1 && (
          <div>
            <div style={S.card}>
              <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 3 }}>{job.jobType === "multi" ? "Unit Types & Rooms" : "Rooms"}</div>
              <div style={{ fontSize: 12, color: "#8a7a60", marginBottom: 14 }}>Room type auto-detects pricing. Upload photos per room to generate AI renders.</div>
              <div style={{ marginBottom: 18, display: "flex", gap: 8, flexWrap: "wrap" }}>
                {[["#c8a84b", "Cabinets (tiered)"], ["#7a9ebf", "Vanity ($30/LI)"], ["#8a6abf", "Wall Unit ($30/LI)"], ["#6abf8a", "Closet (×2/×3 × $14–$18)"]].map(([c, l]) => (
                  <span key={l} style={{ fontSize: 10, color: c, background: c + "18", border: `1px solid ${c}44`, borderRadius: 4, padding: "2px 8px" }}>{l}</span>
                ))}
              </div>
              {job.jobType === "single" ? (
                <>{(job.rooms || []).map((r, i) => <RoomForm key={i} room={r} index={i} onChange={r => updRoom(i, r)} onRemove={() => remRoom(i)} />)}<button onClick={addRoom} style={S.btnGhost}>+ Add Room</button></>
              ) : (
                <>{(job.units || []).map((u, i) => <UnitForm key={i} unit={u} index={i} onChange={u => updUnit(i, u)} onRemove={() => remUnit(i)} />)}<button onClick={addUnit} style={S.btnGhost}>+ Add Unit Type</button></>
              )}
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button style={S.btnGhost} onClick={() => setStep(0)}>← Back</button>
              <button style={S.btnGold} onClick={() => setStep(2)}>Next: Review →</button>
            </div>
          </div>
        )}

        {/* STEP 2 */}
        {step === 2 && (
          <div>
            <div style={S.card}>
              <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 3 }}>Review</div>
              <div style={{ fontSize: 12, color: "#8a7a60", marginBottom: 16 }}>Verify before generating</div>
              <div style={{ marginBottom: 16 }}>
                <span style={S.tag}>📋 {job.clientName || "No name"}</span>
                <span style={S.tag}>📍 {job.address || "No address"}</span>
                <span style={S.tag}>{job.jobType === "multi" ? "Multi-unit" : "Residential"}</span>
                {allRoomsWithPhotos.length > 0 && <span style={S.tag}>📷 {allRoomsWithPhotos.length} room{allRoomsWithPhotos.length > 1 ? "s" : ""} with photos{openaiKey ? " → renders will generate" : " (add OpenAI key for renders)"}</span>}
              </div>

              {job.jobType === "single" ? (
                <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
                  <thead><tr style={{ borderBottom: "1px solid #e8e2d8" }}>{["Room", "Cat", "LI", "Cabs", "CT", "BS", "LED", "Raw"].map(h => <th key={h} style={{ textAlign: "left", padding: "5px 6px", fontSize: 9, color: "#8a7a60", fontWeight: 700 }}>{h}</th>)}</tr></thead>
                  <tbody>
                    {(job.rooms || []).map((r, i) => {
                      const c = calcRoom(r); const name = r.type === "Other" ? (r.customType || "Other") : (r.type || "—");
                      return <tr key={i} style={{ borderBottom: "1px solid #f0ebe0" }}>
                        <td style={{ padding: "5px 6px" }}>{name}{(r.photos || []).length > 0 ? " 📷" : ""}</td>
                        <td style={{ padding: "5px 6px" }}><span style={{ ...badge(c.config.color), marginLeft: 0 }}>{c.config.label}</span></td>
                        <td style={{ padding: "5px 6px" }}>{c.cat === "closet" ? `${c.rawClosetLI}"r` : `${c.totalCabLI}"`}</td>
                        <td style={{ padding: "5px 6px" }}>{fmt(c.cabinetSubtotal)}</td>
                        <td style={{ padding: "5px 6px" }}>{c.ctSF > 0 ? fmt(c.ctSubtotal) : "—"}</td>
                        <td style={{ padding: "5px 6px" }}>{c.bsSF > 0 ? fmt(c.bsSubtotal) : "—"}</td>
                        <td style={{ padding: "5px 6px" }}>{c.ledSubtotal > 0 ? fmt(c.ledSubtotal) : "—"}</td>
                        <td style={{ padding: "5px 6px", fontWeight: 600 }}>{fmt(c.roomRaw)}</td>
                      </tr>;
                    })}
                    <tr style={{ borderTop: "1px solid #ddd8cc", background: "#faf8f2" }}><td colSpan={7} style={{ padding: "6px 6px", fontSize: 11, color: "#6a5a40" }}>Cabinets raw</td><td style={{ padding: "6px 6px", fontWeight: 600 }}>{fmt(grandRawPreview)}</td></tr>
                    <tr style={{ background: "#faf8f2" }}><td colSpan={7} style={{ padding: "4px 6px", fontSize: 11, color: "#6a5a40" }}>Cabinets +15%</td><td style={{ padding: "4px 6px", fontWeight: 600 }}>{fmt(cabBufPreview)}</td></tr>
                    {demoPreview > 0 && <tr style={{ background: "#faf8f2" }}><td colSpan={7} style={{ padding: "4px 6px", fontSize: 11, color: "#6a5a40" }}>Demolition</td><td style={{ padding: "4px 6px", fontWeight: 600 }}>{fmt(demoPreview)}</td></tr>}
                    {installPreview > 0 && <tr style={{ background: "#faf8f2" }}><td colSpan={7} style={{ padding: "4px 6px", fontSize: 11, color: "#6a5a40" }}>Delivery & Install ({installPctPreview}%)</td><td style={{ padding: "4px 6px", fontWeight: 600 }}>{fmt(installPreview)}</td></tr>}
                    <tr style={{ borderTop: "2px solid #c8a84b", background: "#fffdf0", fontWeight: 700 }}><td colSpan={7} style={{ padding: "7px 6px", color: "#8a6020" }}>PROPOSAL TOTAL</td><td style={{ padding: "7px 6px", color: "#8a6020", fontSize: 15 }}>{fmt(grandTotalPreview)}</td></tr>
                  </tbody>
                </table>
              ) : (
                <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
                  <thead><tr style={{ borderBottom: "1px solid #e8e2d8" }}>{["Unit Type", "Qty", "Raw/unit", "×Qty Raw", "+15%"].map(h => <th key={h} style={{ textAlign: "left", padding: "5px 6px", fontSize: 9, color: "#8a7a60", fontWeight: 700 }}>{h}</th>)}</tr></thead>
                  <tbody>
                    {(job.units || []).map((u, i) => { const tot = totalRooms(u.rooms || []); const qty = parseInt(u.qty) || 1; const raw = tot.raw * qty; return <tr key={i} style={{ borderBottom: "1px solid #f0ebe0" }}><td style={{ padding: "5px 6px" }}>{u.name || `Unit ${i + 1}`}</td><td style={{ padding: "5px 6px" }}>{qty}</td><td style={{ padding: "5px 6px" }}>{fmt(tot.raw)}</td><td style={{ padding: "5px 6px" }}>{fmt(raw)}</td><td style={{ padding: "5px 6px", color: "#8a7060" }}>{fmt(applyGrandBuffer(raw))}</td></tr>; })}
                    <tr style={{ background: "#faf8f2" }}><td colSpan={4} style={{ padding: "4px 6px", fontSize: 11, color: "#6a5a40" }}>Cabinets +15%</td><td style={{ padding: "4px 6px", fontWeight: 600 }}>{fmt(cabBufPreview)}</td></tr>
                    {demoPreview > 0 && <tr style={{ background: "#faf8f2" }}><td colSpan={4} style={{ padding: "4px 6px", fontSize: 11, color: "#6a5a40" }}>Demolition</td><td style={{ padding: "4px 6px", fontWeight: 600 }}>{fmt(demoPreview)}</td></tr>}
                    {installPreview > 0 && <tr style={{ background: "#faf8f2" }}><td colSpan={4} style={{ padding: "4px 6px", fontSize: 11, color: "#6a5a40" }}>Delivery & Install ({installPctPreview}%)</td><td style={{ padding: "4px 6px", fontWeight: 600 }}>{fmt(installPreview)}</td></tr>}
                    <tr style={{ borderTop: "2px solid #c8a84b", background: "#fffdf0", fontWeight: 700 }}><td colSpan={4} style={{ padding: "7px 6px", color: "#8a6020" }}>GRAND TOTAL</td><td style={{ padding: "7px 6px", color: "#8a6020", fontSize: 15 }}>{fmt(grandTotalPreview)}</td></tr>
                  </tbody>
                </table>
              )}

              {/* Demo + Delivery/Install add-ons */}
              <div style={{ marginTop: 20, paddingTop: 18, borderTop: "1px solid #f0ebe0" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#6a5a40", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 14 }}>Add-on Services</div>
                <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                  {/* Demo */}
                  <div style={{ flex: "1 1 200px", background: "#fdfcfa", border: "1px solid #e8e2d8", borderRadius: 8, padding: "14px 16px" }}>
                    <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", marginBottom: 10 }}>
                      <input type="checkbox" checked={job.includeDemo || false} onChange={e => sf("includeDemo", e.target.checked)} />
                      <span style={{ fontSize: 12, fontWeight: 700, color: "#1a1714" }}>Demolition</span>
                    </label>
                    <label style={S.label}>Flat Fee ($)</label>
                    <input style={S.input} type="number" placeholder={`${DEFAULT_DEMO_PRICE}`}
                      value={job.demoPrice || ""} onChange={e => sf("demoPrice", e.target.value)}
                      disabled={!job.includeDemo}
                    />
                    {job.includeDemo && <div style={{ fontSize: 10, color: "#9a8a6a", marginTop: 4 }}>→ {fmt(parseFloat(job.demoPrice) || DEFAULT_DEMO_PRICE)} added to total</div>}
                  </div>
                  {/* Delivery & Install */}
                  <div style={{ flex: "1 1 200px", background: "#fdfcfa", border: "1px solid #e8e2d8", borderRadius: 8, padding: "14px 16px" }}>
                    <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", marginBottom: 10 }}>
                      <input type="checkbox" checked={job.includeInstall || false} onChange={e => sf("includeInstall", e.target.checked)} />
                      <span style={{ fontSize: 12, fontWeight: 700, color: "#1a1714" }}>Delivery & Installation</span>
                    </label>
                    <label style={S.label}>% of Cabinet Total</label>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <input style={{ ...S.input, width: 70, flex: "0 0 70px" }} type="number" min="0" max="100"
                        placeholder={`${DEFAULT_INSTALL_PCT}`}
                        value={job.installPct !== undefined ? job.installPct : ""}
                        onChange={e => sf("installPct", e.target.value)}
                        disabled={!job.includeInstall}
                      />
                      <span style={{ fontSize: 12, color: "#6a5a40" }}>%</span>
                    </div>
                    {job.includeInstall && <div style={{ fontSize: 10, color: "#9a8a6a", marginTop: 4 }}>→ {fmt(installPreview)} ({installPctPreview}% of {fmt(cabBufPreview)})</div>}
                  </div>
                </div>
              </div>
            </div>

            {/* Pre-generate renders */}
            {allRoomsWithPhotos.length > 0 && openaiKey && (
              <div style={S.card}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#1a1714", marginBottom: 4 }}>AI Renders</div>
                <div style={{ fontSize: 11, color: "#8a7a60", marginBottom: 14 }}>Generate room renders before finalizing the estimate. These will also appear in the final output.</div>
                <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
                  {allRoomsWithPhotos.map(({ room, unitName }, i) => {
                    const roomName = (unitName ? `${unitName} – ` : "") + ((room.type === "Other" ? room.customType : room.type) || "Room");
                    const existingRender = renders.find(r => r.roomName === roomName);
                    return (
                      <div key={i} style={{ flex: "1 1 200px", minWidth: 180 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: "#6a5a40", marginBottom: 6 }}>{roomName}</div>
                        {!existingRender && (
                          <button style={S.btnGold} onClick={async () => {
                            setRenders(prev => [...prev.filter(r => r.roomName !== roomName), { roomName, loading: true, url: null, error: null }]);
                            try {
                              const result = await generateRender(room, unitName);
                              setRenders(prev => [...prev.filter(r => r.roomName !== roomName), { ...result, loading: false }]);
                            } catch (e) {
                              setRenders(prev => [...prev.filter(r => r.roomName !== roomName), { roomName, loading: false, url: null, error: e.message }]);
                            }
                          }}>Generate Render</button>
                        )}
                        {existingRender?.loading && (
                          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, color: "#8a7a60" }}>
                            <div style={{ width: 14, height: 14, border: "2px solid #c8a84b", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                            Generating…
                          </div>
                        )}
                        {existingRender?.url && (
                          <div>
                            <img src={existingRender.url} alt={roomName} style={{ width: "100%", borderRadius: 6, border: "1px solid #e8e2d8" }} />
                            <button style={{ ...S.btnGhost, marginTop: 6, fontSize: 10 }} onClick={() => setRenders(prev => prev.filter(r => r.roomName !== roomName))}>Regenerate</button>
                          </div>
                        )}
                        {existingRender?.error && <div style={{ fontSize: 10, color: "#a04030" }}>{existingRender.error}</div>}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div style={{ display: "flex", gap: 10 }}>
              <button style={S.btnGhost} onClick={() => setStep(1)}>← Back</button>
              <button style={S.btnGold} onClick={generate}>Generate Estimate ✓</button>
            </div>
          </div>
        )}

        {/* STEP 3 */}
        {step === 3 && (
          <div>
            {loading ? (
              <div style={{ ...S.card, display: "flex", alignItems: "center", gap: 12, color: "#8a7a60", fontSize: 13 }}>
                <div style={{ width: 18, height: 18, border: "2px solid #c8a84b", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                Polishing client proposal…
              </div>
            ) : (
              <>
                <div style={S.card}>
                  <div style={{ display: "flex", borderBottom: "1px solid #e8e2d8", marginBottom: 18, alignItems: "center" }}>
                    {[["client", "📄 Client Proposal"], ["internal", "🔒 Internal Breakdown"]].map(([k, l]) => (
                      <button key={k} onClick={() => setActiveTab(k)} style={{ background: "none", border: "none", padding: "9px 18px", cursor: "pointer", fontFamily: "Georgia,serif", fontSize: 11, fontWeight: 700, letterSpacing: "0.07em", color: activeTab === k ? "#1a1714" : "#8a7a60", borderBottom: activeTab === k ? "2px solid #c8a84b" : "2px solid transparent", marginBottom: -1 }}>{l}</button>
                    ))}
                    {job.revision > 0 && <span style={{ fontSize: 10, background: "#f0ebe0", border: "1px solid #ddd8cc", borderRadius: 3, padding: "2px 8px", color: "#6a5a40", marginLeft: 8, fontWeight: 700 }}>Rev {job.revision}</span>}
                    <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8, paddingBottom: 6 }}>
                      {saveStatus.msg && <span style={{ fontSize: 10, color: saveStatus.type === "saved" ? "#2a7a4a" : saveStatus.type === "error" ? "#a04030" : "#8a6a20" }}>{saveStatus.msg}</span>}
                      <button style={S.copyBtn} onClick={() => copy(activeTab === "client" ? clientOut : internalOut, activeTab)}>{copied === activeTab ? "✓ Copied!" : "Copy"}</button>
                    </div>
                  </div>
                  <div style={S.outputBox}>{activeTab === "client" ? clientOut : internalOut}</div>

                  {/* Renders */}
                  <RenderGallery renders={renders} />
                </div>

                <div style={{ display: "flex", gap: 10 }}>
                  <button style={S.btnGhost} onClick={() => setStep(2)}>← Back</button>
                  <button style={S.btnDark} onClick={reset}>New Estimate</button>
                </div>

                <IntegrationsPanel
                  job={job}
                  clientOut={clientOut}
                  internalOut={internalOut}
                  renders={renders}
                  proposalTotal={grandTotalPreview}
                />
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
