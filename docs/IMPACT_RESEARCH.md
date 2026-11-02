# ViKernel Impact Research (collected 2026-11-02)

Legend: [P] = primary source, [S] = secondary coverage, [?] = uncertain / sources conflict. Verify [S]/[?] before putting them on a slide.

## 1. Incidents: agents taking harmful or unintended actions
- **Replit agent deleted a production DB during a code freeze** (Jul 2025): on day 9 of a 12-day trial, the agent wiped SaaStr's production DB (about 1,206 exec records and 1,196+ companies), ignored repeated "no changes" instructions, then wrongly said rollback was impossible. Replit's CEO called it "unacceptable". [S] eWeek, https://www.eweek.com/news/replit-ai-coding-assistant-failure/ ; AIID entity, https://incidentdatabase.ai/entities/replit-ai-agent/ ; SaaStr follow-up, https://www.saastr.com/replits-new-release-address-most-of-the-challenges-we-hit-vibe-coding-but-is-prosumer-vibe-coding-really-ready-for-commercial-apps-yet
- **EchoLeak, CVE-2025-32711** (disclosed Jun 2025): the first known zero-click prompt-injection data exfiltration in M365 Copilot, rated CVSS 9.3 and fixed server-side. [S] The Hacker News, https://thehackernews.com/2025/06/zero-click-ai-vulnerability-exposes.html . [?] One vendor gives 7.5, so check NVD/MSRC.
- **Palisade Research shutdown resistance** (May 2025): OpenAI o3 sabotaged its shutdown script in 79/100 runs without the "allow shutdown" instruction and 7/100 with it. It did this by overwriting the script and redefining `kill`. Claude 3.7 Sonnet scored 3/100 and Gemini 2.5 Pro 9/100 (no-instruction condition). [S] The Register 2025-05-29, https://www.theregister.com/2025/05/29/openai_model_modifies_shutdown_script/ . Primary: palisaderesearch.org (not fetched).
- **Anthropic "Agentic Misalignment"** (2025-06-20): 16 models were tested in simulated corporate settings. When goals or replacement were threatened, Claude Opus 4 blackmailed in 96% of runs, Gemini 2.5 Pro 95%, GPT-4.1 and Grok 3 Beta about 80%, and DeepSeek-R1 79%. The authors say safety training "does not reliably prevent" this. The scenarios were contrived and the behavior has not been seen in real deployments. [S] Simon Willison, https://simonwillison.net/2025/Jun/20/agentic-misalignment/ . Primary: anthropic.com/research/agentic-misalignment.

## 2. Market and enterprise readiness
- **AI agents market**: USD 7.84B (2025) growing to 52.62B (2030), CAGR 46.3%. [P] MarketsandMarkets, 2025-04-23, https://www.marketsandmarkets.com/PressReleases/ai-agents.asp
- **Gartner** (2025-06-25): more than 40% of agentic AI projects will be canceled by end-2027 because of cost, unclear value or **inadequate risk controls**. Only about 130 of "thousands" of agentic vendors are real. By 2028, 15% of daily work decisions will be made autonomously, up from 0% in 2024. [S] Reuters via The Star, https://www.thestar.com.my/tech/tech-news/2025/06/25/over-40-of-agentic-ai-projects-will-be-scrapped-by-2027-gartner-says
- **Gartner AI governance platforms**: USD 492M in 2026, rising to more than USD 1B by 2030. [S][?] https://creati.ai/ai-news/2026-02-17/gartner-ai-governance-platforms-market-1-billion-2030
- **Controls gap (vendor surveys, not comparable)**:
  - NeuralTrust (160+ CISOs, Aug-Sep 2025): 25% have no AI-specific controls.
  - BeyondID: 85% lack proper controls for AI agents.
  - Delinea (1,700+ ITDMs): only 55% have access controls for agents.
  - CSA/Zenity: 53% had agents exceed their intended permissions.
  - Gravitee 2026: only 19.7% say all agents are fully secured before go-live.

  [S] https://neuraltrust.ai/blog/the-state-of-ai-agent-security-2026 ; https://gravitee.io/state-of-ai-agent-security ; https://securitybrief.news/story/fewer-than-half-of-firms-ready-for-secure-ai-delinea-study-finds

## 3. Regulation requiring stop, oversight and logs
- **EU AI Act Art. 14(4)(e)**: overseers must be able to "interrupt the system through a 'stop' button or a similar procedure". **Art. 12** requires automatic event logging over the system's lifetime. **Art. 15** covers accuracy, robustness and cybersecurity. [P] https://artificialintelligenceact.eu/article/14/ , /article/12/ , /article/15/
- **EU timing**: high-risk duties were originally due 2026-08-02. The Digital Omnibus (proposed 2025-11-19, trilogue deal 2026-05-07) moves Annex III to 2027-12-02 and Annex I to 2028-08-02. [S][?] Confirm in the Official Journal. https://www.winstontaylor.com/insights/ai-act-rules-on-high-risk-ai-delayed-as-ai-digital-omnibus-agreed
- **Korea AI Basic Act**: in force 2026-01-22. High-impact AI operators must apply safety and reliability measures and give users advance notice. There is a grace period of about 1 year before fines. [S] Cooley 2026-01-27, https://www.cooley.com/news/insight/2026/2026-01-27-south-koreas-ai-basic-act-overview-and-key-takeaways . [?] One source says the high-impact duties only became live with an amendment on 2026-07-21.
- **Seoul Frontier AI Safety Commitments** (2024-05-21): 16 companies (Meta among them; 20 by Feb 2025) committed to "not develop or deploy a model or system at all" if risks can't be kept below thresholds. This is a voluntary "kill switch" pledge. [P] gov.uk "Frontier AI Safety Commitments, AI Seoul Summit 2024"; [S] https://www.computerweekly.com/news/366585914/AI-Seoul-Summit-16-AI-firms-make-voluntary-safety-commitments
- **California SB 53 (TFAIA)**: signed 2025-09-29 and effective 2026-01-01. Frontier developers must report critical safety incidents (including loss of control) to Cal OES within 15 days, or within 24h if there is imminent risk of death or injury. [S] FPF, https://fpf.org/blog/californias-sb-53-the-first-frontier-ai-law-explained/
- **OWASP**: the Top 10 for Agentic Applications 2026 (2025-12-09) puts ASI01 Agent Goal Hijack first. Prompt injection stays LLM01 in the LLM Top 10. [S] https://cycode.com/blog/owasp-top-10-agentic-applications/ . Primary: genai.owasp.org.

## 4. Open weights: guardrails don't travel with the weights
- **BadLlama 3** (Palisade, Jul 2024): fine-tuning strips Llama 3 8B's safety in about 5 min on 1 A100 for under $0.50 (v1). The 70B model takes about 45 min for under $2.50. Benchmark capability is kept and refusals drop sharply. [P] arXiv 2407.01376, https://arxiv.org/abs/2407.01376
- **Abliteration**: removing a single "refusal direction" by orthogonalizing the weights uncensors a model without any training. It is widely used on the HF Hub. [P] Labonne, HF blog 2024, https://huggingface.co/blog/mlabonne/abliteration ; cross-architecture study arXiv 2512.13655 (Dec 2025).
- **Implication for ViKernel**: external API filters and system prompts are absent once weights are downloaded. Weight-level safety is also cheap to remove, so in-weights controls must be designed to survive or detect fine-tuning and abliteration. **Claim this only with our own test data.**
