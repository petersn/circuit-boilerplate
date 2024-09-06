import React, { useState } from 'react';
import ReactDOM from 'react-dom';
import { TLV62578_TEMPLATE, LMR33630_TEMPLATE } from './Strings';

const resistor_to_0402_lcsc: Record<number, string> = {
  10000: "C25744",
  11000: "C25749",
  12000: "C25752",
  13000: "C25754",
  15000: "C25756",
  16000: "C25759",
  18000: "C25762",
  20000: "C25765",
  22000: "C25768",
  24000: "C25769",
  27000: "C25771",
  30000: "C25776",
  33000: "C25779",
  36000: "C43676",
  39000: "C25783",
  43000: "C8329",
  47000: "C25563",
  51000: "C25794",
  56000: "C25796",
  62000: "C37825",
  68000: "C36871",
  75000: "C25798",
  82000: "C4142",
  91000: "C4147",
  100000: "C25741",
  110000: "C25745",
  120000: "C25750",
  130000: "C52929",
  150000: "C25755",
};

type Device = 'TLV62578' | 'LMR33630';

const device_info_table: Record<Device, {
  template: string;
  formula: (r1: number, r2: number) => number;
  vinMin: number;
  vinMax: number;
  voutMin: number;
  voutMax: number;
  currentMax: number;
}> = {
  TLV62578: {
    template: TLV62578_TEMPLATE,
    formula: (r1, r2) => 0.6 * (1 + r1 / r2),
    vinMin: 2.5,
    vinMax: 5.5,
    voutMin: 0.6,
    voutMax: 5.5,
    currentMax: 1.0,
  },
  LMR33630: {
    template: LMR33630_TEMPLATE,
    formula: (r1, r2) => 1 + r1 / r2,
    vinMin: 3.8,
    vinMax: 36,
    voutMin: 1,
    voutMax: 24,
    currentMax: 3.0,
  },
};

interface Feedback {
  r1: number;
  r2: number;
  achievedVoltage: number;
  kicadCode: string;
}

function makeFeedback(
  template: string,
  formula: (r1: number, r2: number) => number,
  targetFeedbackResistance: number,
  outputVoltage: number,
): Feedback {
  const solutions = Object.keys(resistor_to_0402_lcsc).flatMap(R1 => 
    Object.keys(resistor_to_0402_lcsc).map(R2 => 
      [parseInt(R1), parseInt(R2)] as [number, number]
    )
  );

  const grade = (R1: number, R2: number) => {
    const achievedVoltage = formula(R1, R2);
    const voltageError = Math.abs(outputVoltage - achievedVoltage);
    const resistanceError = Math.abs(targetFeedbackResistance - (R1 + R2));
    return 1e5 * voltageError + resistanceError;
  }

  const best = solutions.reduce((a, b) => 
    grade(a[0], a[1]) < grade(b[0], b[1]) ? a : b
  );

  const achievedVoltage = formula(best[0], best[1]);

  const replacements = {
    "{{VOUT}}": achievedVoltage.toFixed(2),
    "{{R1val}}": `${(best[0] * 1e-3).toFixed(0)}k`,
    "{{R2val}}": `${(best[1] * 1e-3).toFixed(0)}k`,
    "{{R1lcsc}}": resistor_to_0402_lcsc[best[0]],
    "{{R2lcsc}}": resistor_to_0402_lcsc[best[1]],
  };

  for (const [key, value] of Object.entries(replacements)) {
    template = template.replace(key, value);
  }

  return {
    r1: best[0],
    r2: best[1],
    achievedVoltage,
    kicadCode: template,
  };
}

// const makeTLV62578 = (targetFeedbackResistance: number, targetVoltage: number): Feedback => {
//   return makeFeedback(TLV62578_TEMPLATE, (r1, r2) => 0.6 * (1 + r1 / r2), targetFeedbackResistance, targetVoltage);
// }

// const makeLMR33630 = (targetFeedbackResistance: number, targetVoltage: number): Feedback => {
//   return makeFeedback(LMR33630_TEMPLATE, (r1, r2) => 1 + r1 / r2, targetFeedbackResistance, targetVoltage);
// }

function App() {
  const [device, setDevice] = useState<Device>('TLV62578');
  const [targetFeedbackResistance, setTargetFeedbackResistance] = useState(40);
  const [targetVoltage, setTargetVoltage] = useState(1.2);

  const handleVoltageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const voltage = parseFloat(e.target.value);
    setTargetVoltage(voltage);
  };

  const device_info = device_info_table[device];

  const { r1, r2, achievedVoltage, kicadCode } = makeFeedback(
    device_info.template,
    device_info.formula,
    1e3 * targetFeedbackResistance,
    targetVoltage,
  );

  const copyToClipboard = () => {
    navigator.clipboard.writeText(kicadCode).then(() => {
      alert('Design copied to clipboard!');
    });
  };

  return (
    <div style={{ marginLeft: 20 }}>
      <h1>Step-down Converter</h1>
      <div>
        <label htmlFor="device">Device: </label>
        <select
          id="device"
          value={device}
          onChange={(e) => setDevice(e.target.value as Device)}
        >
          <option value="TLV62578">TLV62578</option>
          <option value="LMR33630">LMR33630</option>
        </select><br/>
        <div>
          <p>Vin: {device_info.vinMin}V - {device_info.vinMax}V</p>
          <p>Vout: {device_info.voutMin}V - {device_info.voutMax}V</p>
          <p>Output current: {device_info.currentMax}A</p>
        </div>
        <label htmlFor="voltage">Target Voltage: </label>
        <input
          id="voltage"
          type="number"
          step="0.1"
          value={targetVoltage}
          onChange={handleVoltageChange}
        /><br/>
        <label htmlFor="resistance">Target Feedback Resistance: </label>
        <input
          id="resistance"
          type="number"
          step="1"
          value={targetFeedbackResistance}
          onChange={(e) => setTargetFeedbackResistance(parseInt(e.target.value))}
        />k
      </div>
      <div>
        <h2>Solution:</h2>
        <p>R1: {r1 * 1e-3}k</p>
        <p>R2: {r2 * 1e-3}k</p>
        <p>Achieved Voltage: {achievedVoltage.toFixed(3)}V</p>
      </div>
      <button onClick={copyToClipboard}>Copy Design to Clipboard</button>
    </div>
  );
}

ReactDOM.render(
  <App />,
  document.getElementById('root')
);
