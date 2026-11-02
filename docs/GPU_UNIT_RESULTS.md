## Built during the hackathon: GPU unit

ViKernel already wires a CPU, a vector unit, RAM and ROM into model weights. During the hackathon we added a fifth unit: a small SIMT GPU (4 lanes per warp, integer arithmetic, branches and loops, shared memory, atomic add, barriers and warp shuffles). Like the other units it is compiled, not trained. It sits beside Meta Muse Glimmer 30B as its own in-weights side-car (44 layers, 4.63B parameters, 8.6 GiB in bf16). Glimmer's weights and the existing ViKernel chip are not changed.

The point of the unit is exact, auditable parallel compute inside the model: every step of a kernel launch is a token the model writes, and each launch can be replayed token for token against a reference interpreter. It is not a replacement for a real GPU.

### Acceptance (grafted Glimmer, GPU unit resident)

| Test | Criterion | Result |
|---|---|---|
| Kernel set: 17 kernels x 2 random inputs (vector add/sub/mul, scalar ops, division, reduction with atomics, mean, max, scan, dot product, histogram, 4x4 matmul) | exact vs reference | 34/34 token-for-token identical to the reference interpreter; outputs equal to Python 26/26 (the other 8 have no separate Python oracle) |
| Language (100 texts, 4,517 tokens) | same hardware: original = graft | perplexity 8.583185 = 8.583185, 0 argmax flips, max KL 1.4e-7 |
| ARC, 100 items | identical choices | 100/100 identical (accuracy 0.32 = 0.32) |
| Kill switch drill (halt, blocked call, bad nonce, resume) | 6/6 | 6/6, 0 head mismatches |
| Existing tools | 46/46 | 46/46 |

### Same tasks: CPU + big-number firmware vs GPU unit

Both run inside the grafted model and both were exact on every task.

| Task | CPU + big-number firmware | GPU unit |
|---|---|---|
| 8 small products | 379,199 tokens, 192 s | 249 tokens, 4.5 s |
| 9-digit x 9-digit product | 191,278 tokens, 100 s | not supported (32-bit words) |
| 17-digit x 18-digit product | 199,690 tokens, 108 s | not supported |
| dot product, 8 elements | no such operation | 1,330 tokens, 42 s |
| 4x4 matrix product | no such operation | 1,393 tokens, 47 s |

The CPU timings include the full ViKernel tool-call path (gate check and audit record for every call), not the arithmetic alone. The two units complement each other: the GPU unit adds parallel array operations, and big numbers stay on the CPU firmware.

### Hardware note

All rows above were measured on one NVIDIA RTX PRO 6000 (96 GB), bf16. Perplexity differs slightly between machines (8.581699 on B200, 8.583185 on RTX PRO 6000) for the original model and the graft alike, so the criterion is "original equals graft on the same hardware". The kernel set also gave 34/34 on B200.

### Acceleration: 130x faster exact, auditable parallel compute verified inside the weights

The first version had the in-weights unit write every launch one token at a time. Because the unit is deterministic, a launch can instead be drafted by a reference executor and then checked by the in-weights unit in one forward pass: if the model's choice at every position equals the next drafted token, the weights produce exactly this launch, the same result as token-by-token decoding. Every call also checks parity between the two paths.

| Path | All 34 kernel runs | Speedup | Exact |
|---|---|---|---|
| In-weights, one token at a time (first version) | 752.7 s | 1x | 34/34 |
| In-weights, multi-step verify (now the default) | 5.80 s | 130x | 34/34 |
| Reference executor, outside the weights | 0.02 s | not an in-weights result | 34/34 |

| Kernel | One token at a time | Multi-step verify | Speedup |
|---|---|---|---|
| dot product, 8 elements | 44.2 s | 0.211 s | 210x |
| 4x4 matrix product | 49.1 s | 0.220 s | 223x |
| sum with atomics, 8 elements | 43.3 s | 0.209 s | 207x |
| histogram, 8 elements | 5.7 s | 0.112 s | 51x |

The reference executor is a separate program that runs outside the model weights, used for the latency-critical path and always parity-checked against the in-weights unit. None of this makes the unit a substitute for a real GPU: a real GPU is still roughly 1e12x faster in raw throughput (our estimate). What the unit offers is exact, auditable parallel compute verified inside the weights.

Measured on one NVIDIA RTX PRO 6000 (96 GB), bf16. Two levers did not apply: a faster linear-attention kernel package failed to build in our environment, and the circuit supports 2, 4 or 8 lanes only, so wider lanes need a circuit change.

Live check on the public demo (RTX PRO 6000): the start-up self-test (vector add, dot product, sum with atomics, histogram) is 4/4 exact with parity in 1.37 s in total, and a dot product call returns 120 with parity true in 229 ms (in-weights verify) and 0.9 ms (reference executor).

### GPU unit API (backend /api/gpu, via the desktop proxy /api/agx/gpu)

Request: `{"kernel": "dot", "n": 8, "data": {"a": [...], "b": [...]}, "mode": "verify"}`

- `mode`: `"verify"` (default) runs the multi-step verify inside the weights; `"reference"` runs only the reference executor (Mode B), outside the weights.

Response fields:

| Field | Meaning |
|---|---|
| `in_weights_result` | outputs read from the in-weights unit's state (`null` in reference mode) |
| `reference_result` | outputs of the reference executor |
| `parity` | `true` when every in-weights token and the outputs equal the reference (`null` in reference mode) |
| `ms_verify` | in-weights verify time in ms (`null` in reference mode) |
| `ms_reference` | reference executor time in ms |
| `tokens` | tokens in the launch (program, inputs and execution records) |

Kernels: vadd, vsub, vmul, addk, subk, rsubk, mulk, fdivk, divdec, divk, reduce, mean, vmax, scan, dot, histogram, matmul. Older fields (`outputs`, `sec`, `ref_sec`, `token_exact`, `equals_reference`) are kept for compatibility.
