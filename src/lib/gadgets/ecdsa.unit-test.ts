import { createCurveAffine } from '../../bindings/crypto/elliptic_curve.js';
import { Ecdsa, EllipticCurve, Point } from './elliptic-curve.js';
import { Field3 } from './foreign-field.js';
import { secp256k1Params } from '../../bindings/crypto/elliptic-curve-examples.js';
import { Provable } from '../provable.js';
import { createField } from '../../bindings/crypto/finite_field.js';
import { ZkProgram } from '../proof_system.js';

const Secp256k1 = createCurveAffine(secp256k1Params);
const BaseField = createField(secp256k1Params.modulus);

let publicKey = Point.from({
  x: 49781623198970027997721070672560275063607048368575198229673025608762959476014n,
  y: 44999051047832679156664607491606359183507784636787036192076848057884504239143n,
});

let signature = Ecdsa.Signature.fromHex(
  '0x82de9950cc5aac0dca7210cb4b77320ac9e844717d39b1781e9d941d920a12061da497b3c134f50b2fce514d66e20c5e43f9615f097395a5527041d14860a52f1b'
);

let msgHash =
  Field3.from(
    0x3e91cd8bd233b3df4e4762b329e2922381da770df1b31276ec77d0557be7fcefn
  );

const ia = EllipticCurve.initialAggregator(BaseField, Secp256k1);
// TODO doesn't work with windowSize = 3
const tableConfig = { windowSizeG: 2, windowSizeP: 2 };

let program = ZkProgram({
  name: 'ecdsa',
  methods: {
    scale: {
      privateInputs: [],
      method() {
        let G = Point.from(Secp256k1.one);
        let P = Provable.witness(Point, () => publicKey);
        let R = EllipticCurve.doubleScalarMul(
          Secp256k1,
          ia,
          signature.s,
          G,
          signature.r,
          P,
          tableConfig
        );
        Provable.asProver(() => {
          console.log(Point.toBigint(R));
        });
      },
    },
    ecdsa: {
      privateInputs: [],
      method() {
        let signature0 = Provable.witness(Ecdsa.Signature, () => signature);
        Ecdsa.verify(
          Secp256k1,
          ia,
          signature0,
          msgHash,
          publicKey,
          tableConfig
        );
      },
    },
  },
});
let main = program.rawMethods.ecdsa;

console.time('ecdsa verify (constant)');
main();
console.timeEnd('ecdsa verify (constant)');

console.time('ecdsa verify (witness gen / check)');
Provable.runAndCheck(main);
console.timeEnd('ecdsa verify (witness gen / check)');

console.time('ecdsa verify (build constraint system)');
let cs = Provable.constraintSystem(main);
console.timeEnd('ecdsa verify (build constraint system)');

let gateTypes: Record<string, number> = {};
gateTypes['Total rows'] = cs.rows;
for (let gate of cs.gates) {
  gateTypes[gate.type] ??= 0;
  gateTypes[gate.type]++;
}

console.log(gateTypes);

console.time('ecdsa verify (compile)');
await program.compile();
console.timeEnd('ecdsa verify (compile)');

console.time('ecdsa verify (prove)');
let proof = await program.ecdsa();
console.timeEnd('ecdsa verify (prove)');
