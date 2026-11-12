# Interactive memristor simulator

Move a slider, or type an exact value, and the current–voltage hysteresis is **re-simulated** with the deterministic model. The simulation uses the Python code itself, running in your browser; no curve is interpolated or pre-computed.

Two models are shown:
- **Free data**, where every parameter value is a fitted value, chosen to best match the experimental data.
- **Ab initio**, with the first-principles activation energies $E_\mathrm{set,fp}$ and $E_\mathrm{reset,fp}$.

Both are compared with the experimental data. Every slider starts at the value used in the original code (↺ resets it). The equations are on the [Model & Equations](#model) page.
