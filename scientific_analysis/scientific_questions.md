# Open Scientific Questions for the Model Author

**Project:** Memristor Interactive Website — Phase 1 (scientific analysis)
**Compiled by:** coordinator, from `deterministic_analysis.md` and `verilog_tcam_analysis.md`
**Status:** awaiting author answers. Nothing below has been assumed in the website design yet.

Each question names the source line(s) that raise it and explains why it matters for the website. Questions are grouped by priority:

- **A:** blocks the website design.
- **B:** affects how parameters are documented or labelled.
- **C:** clarification or validation.

---

## A. Blocking questions (needed before backend/GUI design)

### A1. Which Python file is authoritative?
There are two copies of the deterministic model.
- `original_code/Luisier_IOP_deterministic.py` uses `beta*(v/L)`.
- The copy at the root of `D:\Memristor_Website` uses `alpha = beta/(L*q)` with `alpha*(q*v)` and has no `dU_dw` method.

Agent 1 showed the two are mathematically identical: q cancels, and outputs differ by at most about 2e-12, which is rounding. So the question is about intent, not behaviour.
- **Website impact:** decides which form the documentation presents, and what the GUI calls the parameter.

### A2. What exactly should the "alpha" slider control?
Three different quantities carry this name or meaning:
- **Raw `alpha`:** about 5.36e18 in Python, 5.3e18 in Verilog-A. The units are not stated in the source. Dimensional analysis suggests 1/(C·m)·(eV-scaled), which is an inference.
- **`alpha·q = beta/L`:** about 0.857 eV/V (empirical) or 0.800 eV/V (`_fp`). This is the dimensionless barrier-lowering factor that actually enters the exponent.
- **`beta` and `L` separately:** these only ever appear as the ratio beta/L.

Our recommendation is to expose `alpha·q` (in eV/V) as the slider and display the raw alpha alongside it. This needs your confirmation.
- **Is Verilog-A `alpha = 5.3e18` a rounded β/(L·q) = 5.357e18?** The rounding lowers the coupling by about 1 %.

### A3. What does `_fp` mean?
- The plot labels the `_fp` curve "Ab inito Model" and the other curve "Emperical Model" (Python lines 264–265). That suggests `_fp` means **first-principles**, not "free parameter".
- **Please confirm.** Your project brief refers to "free-parameter and ab initio-informed variants". Which code set corresponds to which?
- **Where do the values come from?** Please give the source (DFT calculation, paper or table) for `beta_fp`, `Eset_fp` and `Ereset_fp`, and say how the empirical `beta`, `Eset` and `Ereset` were obtained.

### A4. Which parameter set does the Verilog-A model represent?
The Verilog-A file mixes values from both Python sets and adds some of its own:
- **Matches `_fp`:** activation energies Eset = 3.0 eV and Ereset = 3.5 eV.
- **Matches empirical, roughly:** coupling ≈ 0.849 eV/V.
- **Matches neither Python set:**

  | Parameter | Verilog-A | Python |
  |---|---|---|
  | `k_attempt` | 1e12 | 6e12 |
  | `Is` | 1e-10 | 5e-9 |

Was the Verilog-A model refitted for TCAM use, or should it match one of the Python sets?
- **Website impact:** whether the site can present "one model, two implementations", or must present them as two parameterisations.

### A5. Which device is being modelled?
- The Verilog-A header says "MoTe2 Phase Change Memristor" (line 2).
- The parameter comment says "Table 2, D11: Ag/WSe2" (line 17).

Which is correct, and what is the reference publication (it appears to be Luisier et al., IOP)? We need the full citation to cite it on the site.

### A6. Does the Verilog-A model's use of `w` from the previous evaluation reflect how SmartSpice behaved for you?
- **The pattern:** `w` is read at lines 49, 54 and 66–67 before it is assigned by `idt()` at line 69. It also has no initial value. The code therefore relies on the simulator carrying `w` over from the previous evaluation.
- **Why it matters:** other compilers, such as OpenVAF (for ngspice) and Xyce, may handle this differently. We infer, but have not tested, that RESET might never trigger there.
- **The clip:** lines 71–72 change only the local copy of `w`, not the integrator's state.

Did the TCAM simulations run as intended in SmartSpice? Would you accept a corrected, portable version that is clearly marked as an adaptation?

---

## B. Parameter definitions and units

### B1. What units do the conduction parameters use?
None of these units is stated in the source:
- `Is` (A?)
- `G0` in Python and `G_metallic` in Verilog-A (S?)
- `vt` (V?)
- `V_max` (V)
- `freq` (Hz)

What does the comment "DP1 conductance" mean? Is `G0 × N_channels` intended as a quantised-conductance picture (G0 = 2e²/h)?

### B2. Should `vt` track temperature?
`vt = 0.026` is fixed in both codes, but T appears in the Arrhenius rate. On the site, a T slider would change switching but not the conduction law. Is that intended?

### B3. How should the ideality factors be interpreted?
- **Selection rule:** `n_set` and `n_reset` are chosen by the sign of V, not by the switching process. Is that intended?
- **Values:** n ≈ 15–16 is very large for a Schottky diode ideality factor. Are these effective fitting parameters rather than physical ideality factors? This decides whether they are labelled "physical" or "fitting" on the site.

### B4. What is `Ea = 2.0`?
`Ea = 2.0` is defined in Python but never used. Is it a leftover, or should it enter the model? How does it relate to Eset and Ereset?

### B5. Are the window exponents physical or fitted?
Are `p_set = 9` and `p_reset = 0.8` fitted values, or do they have a physical motivation?

### B6. Is the linear current blend intended?
`I = (1−w)·I_sch + w·I_met`. Is this the intended form, or is a parallel-conductance or filament-area model the underlying picture?

### B7. Why is the Schottky law symmetric?
The Verilog-A Schottky term is symmetric and exponential in both polarities, with no reverse saturation (lines 83–87). Is that intentional?

### B8. Were the state bounds meant to set the high-resistance current?
- **The bounds:** w is held between 0.001 and 0.999.
- **What they do in Verilog-A:** the 0.001 bound in effect sets the low-bias high-resistance (HRS) current, about 2 MΩ, through the metallic term.
- **What they do in Python:** under SET, w stops at about 0.987–0.996.

Were these bounds meant to set the residual current?

### B9. Is the 1e-11 A current floor physical?
The floor on |I| in Python: is it a physical floor, an instrument floor, or only for display?
- **Website impact:** the semilog plot needs it, but we will label it as a display floor unless you say otherwise.

---

## C. Data, calibration and validation

### C1. What is the embedded experimental data?
- **Source:** which device, which units, and what sweep rate?
- **Sweep mismatch:** the data peaks at +3.48 V, but the simulation sweeps to 4 V. Why?
- **Fit quality:** the current fit differs by about 1.1 decades RMS. This is our metric, not one from the source. Is a better calibration available?

### C2. Is there a fitting procedure?
None exists in the code. If the parameters were fitted elsewhere, can you share that procedure? The site would document it as external.

### C3. How tight is the RESET margin?
At the default settings, RESET only just completes at the 4 V peak. The device gets stuck in the ON state if any one of these changes:
- beta drops 7 %
- Ereset rises 10 %
- V_max falls to 3.6 V
- T falls to 150 K

Is this tight margin expected physically? Should the GUI's V_max slider default above 4 V?

---

## D. TCAM circuit (`TCAM_new.in`)

### D1. Which simulator and models were used?
- Which simulator and version: SmartSpice, and which release?
- The MOSFETs are bare `level=1` cards with no parameters. Did you rely on the simulator's defaults (threshold voltage, KP)?
- Is a real PDK, for example 180 nm, meant to replace these cards?

### D2. How is ternary data encoded?
The deck has one 3T1R cell with an unchanged search key and no don't-care case.
- How are 0, 1 and X encoded in the memristor state?
- Is "SET-M", the partial write, the third state?
- What search-line levels correspond to search-0, search-1 and don't-care?

### D3. How is the match line sensed?
There are no `.meas` statements in the deck. Is the match line sensed by timing or by a threshold?
- **Our check:** with default Level-1 parameters, our Python check shows the match line discharging fully in all three searches, only at different rates: about 1 ns versus 2.6 µs. This is a Python re-implementation, not a SPICE run.

### D4. Why these bias levels?
What is the reasoning behind the 1.65 V "Goldilocks" bias and the 6 V / 4.5 V write levels?

### D5. Can you supply your simulator's output?
Can you provide SmartSpice output waveforms (CSV or raw) for the TCAM deck? Without them, the site can show only:
- the schematic and operating sequence
- results clearly labelled as coming from the Python single-device model

It cannot show transistor-level TCAM simulations.

---

## How the answers will be used
- **A1–A6:** fix the backend API, the parameter names, the slider ranges, and which variants the site exposes.
- **B and C:** fix the parameter classification shown on the site (physical, numerical or fitting) and the units shown on the site.
- **D:** decides how much of the TCAM section is analysis and documentation, and how much can show supplied simulator results.

Until answered, the website will show "not stated in source" for every unresolved unit or meaning.
