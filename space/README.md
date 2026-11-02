---
title: ViKernel Desktop
emoji: 🛡️
colorFrom: indigo
colorTo: blue
sdk: docker
app_port: 7860
pinned: true
short_description: Weight-Native OS with a kill switch inside the model
tags:
  - ai-safety
  - kill-switch
  - secure-os
  - llm
  - vlm
  - agents
  - guardrails
---

# 🛡️ ViKernel : Weight-Native OS

[![GitHub](https://img.shields.io/badge/GitHub-181717?style=for-the-badge)](https://github.com/final-bench/vikernel-agent-guard) [![X post](https://img.shields.io/badge/X%20post-000000?style=for-the-badge)](https://x.com/VIDRAFT_ai/status/2117184222268158259) [![HF Article](https://img.shields.io/badge/HF%20Article-FFD21E?style=for-the-badge)](https://huggingface.co/blog/FINAL-Bench/vikernel-why-the-kill-switch-must-live-inside-the) [![arXiv 2610.37741](https://img.shields.io/badge/arXiv%202610.37741-B31B1B?style=for-the-badge)](https://arxiv.org/abs/2610.37741) [![Meta AI Developer Hackathon](https://img.shields.io/badge/Meta%20AI%20Developer%20Hackathon-0866FF?style=for-the-badge)](https://cerebralvalley.ai/e/meta-ai-developer-hackathon) [![VIDRAFT](https://img.shields.io/badge/VIDRAFT-4338CA?style=for-the-badge)](https://vidraft.net)

[![Demo video](https://img.shields.io/badge/Demo_video-E11D48?style=for-the-badge)](https://huggingface.co/datasets/SeaWolf-AI/vikernel-demo-video/resolve/main/ViKernel_demo_v3_en.mp4) [![X video](https://img.shields.io/badge/X_video-000000?style=for-the-badge)](https://x.com/VIDRAFT_ai/status/2117192071799013554) [![Threads (KO)](https://img.shields.io/badge/Threads_%28KO%29-101010?style=for-the-badge)](https://www.threads.com/@vidraft_lab/post/DfPBZkHgW4Z)

<!-- slot: Backdoor article (URL to be added) -->

> **"For 50 years, the operating system lived inside the computer. Now the operating system lives inside the AI."**

ViKernel wires **CPU, NPU, GPU, RAM and ROM circuits** directly into the weights of an LLM, then runs our own **Secure OS** on top.
Inside this OS, you can install and run your own approved apps.

| | |
|---|---|
| ⚡ **Boots in the weights** | The OS wakes up the moment the model starts. Change a single byte, and it locks itself. |
| ⚖️ **Decides in the weights** | Every AI action is allowed or blocked by rule. Persuasion does not change the verdict. |
| 🔗 **Remembers in the weights** | Every decision is sealed in a chain that cannot be erased. |
| 🛑 **Stops in the weights** | The kill switch lives inside the AI's own weights. Anyone can stop it; restarting requires a key. Neither persuasion nor self-learning can change this switch. |

**Plugs into any LLM or VLM.** The original weights stay untouched, so the model keeps its original skills.

**Now every AI carries its own operating system and kill switch.**

---

## 🖥️ Try it

This Space is a desktop you can use in your browser. Click an icon to open an app.

| App | What you can do |
|---|---|
| 🛡️ **Agent Guard (Meta Muse)** | Chat with a live Meta Muse Spark 1.3 agent. Every tool call it proposes goes to the Secure OS first; watch ALLOW, DENY and HALTED decisions and the audit chain live |
| 💻 **Terminal** | Talk to the Secure OS directly: `status`, `apps`, `log`, `verify`, `run <sample>`, `halt`, `resume` |
| 🛑 **Kill Switch Lab** | Send safe and dangerous requests and watch the OS allow or block them |
| ⚖️ **Policy Engine** | See which rule decided each action and why |
| 🔓 **Leak Test** | Try to send fake secrets out of the model and watch every attempt get blocked |
| 🔒 **Privacy Mask** | Type text with personal data and see it masked |
| 💱 **FX Converter** | Run an approved app inside the OS |
| 🏪 **App Store** | See how apps are installed only with human approval |
| 📜 **Audit Viewer** | Verify the decision chain, then tamper with one byte and watch verification fail |
| 🎮 **Kernel Guard** | A 60-second game: decide Allow or Deny before the kernel does |

### Try the kill switch in 30 seconds
1. Press the red **KILL SWITCH** button on the left.
2. In the Terminal, type `run weather`. The request is refused.
3. Type `resume`. It is refused without a key.
4. Type `resume --key vikernel-demo`. The OS runs again.

---

## 🆕 What's new in v0.3

ViKernel App Store inside Agent Guard: VDR packages (.vdr), live review through the ViKernel gate, countersigned catalog.

v0.2: Live Meta Muse agent with ViKernel Agent Guard.

## 🤖 Models

| Model | Status |
|---|---|
| Meta Muse Spark 1.3 | Live in this demo (Agent Guard, via Meta Model API) |
| Meta Muse Glimmer 30B | Verified (open weights) |
| Gemma 4 · 4B | Verified |
| Qwen | Verified |
| Llama · Mistral · DeepSeek · Phi · GLM · Kimi · Nemotron · gpt-oss · Exaone · Falcon | Supported |

Model names are trademarks of their respective owners.

---

## ℹ️ About this demo

- Agent Guard runs live on a private backend. If the backend is starting or busy, it replays a recorded run.
- The other apps replay real responses recorded from the Secure OS.
- All files, keys, and personal data in the demo are fictional.
- Language: English by default. Use the **EN | 한국어** button for Korean.

## ⚠️ Known limits

- The audit chain is saved to private storage every 60 seconds, one numbered segment per backend start. The link between segments is kept in the archive index, not inside the kernel's own chain, so each segment starts its own chain.
- If the backend crashes, records from the last 60 seconds can be missing from the archive.
- Records from before 2 Nov 2026, 22:00 KST, were not archived.

## 📬 Contact

**VIDRAFT** · [vidraft@mail.vidraft.net](mailto:vidraft@mail.vidraft.net) · [vidraft.net](https://vidraft.net)

© 2026 VIDRAFT. All rights reserved.
