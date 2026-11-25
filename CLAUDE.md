# SatyaCall — read before doing anything
Hackathon project (Ananth AI Hackathon × DetectifAI, Track 03 "The Trust Layer"), built by 2 people in parallel.

1. Read `docs/PLAN.md` (concept, rules, API contract §5, merge protocol §7), `docs/DETECTIF_API.md` (real DetectifAI fields).
2. Ask which person the user is, then read `docs/PERSON_A.md` (backend) or `docs/PERSON_B.md` (frontend) and work only in that person's folder.
3. Follow the contract in `docs/PLAN.md` §5 exactly; never change it without the user confirming both teammates agreed.
4. Decide with DetectifAI's `verdict` / `decision`; scores are evidence only. Aletheia `score`: higher = more likely AI. Eidos `similarity`: −1..1, not a %.
5. No fake data, hard-coded or random scores, or simulated results. Every result = evidence + next step.
6. Never commit `.env` or the API key. Keep code simple and explainable.
