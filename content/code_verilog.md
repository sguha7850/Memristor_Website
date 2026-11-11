# Verilog-A model & TCAM circuit

> **Circuit simulation is not run on this website.** Verilog-A and SPICE netlists need a circuit simulator with a Verilog-A compiler. The circuit results shown here are the author's **SmartSpice output** (supplied figure). See [Running the circuit simulation](#code-verilog/running-the-circuit-simulation) for the requirements.

{{toc}}

## Summary

| | |
|---|---|
| **Files** | `original_code/A_Mem_Code_Alpha.va` (device model), `original_code/TCAM_new.in` (3T1R TCAM test bench) |
| **Simulator used by the author** | Silvaco SmartSpice (commercial); the circuit works as intended there (author) |
| **Device model** | Same equations as the deterministic Python model: Arrhenius SET/RESET kinetics with window functions, and a linear Schottky/metallic current blend |
| **Parameter set** | Activation energies equal the first-principles values (3.0 / 3.5 eV); other values are as written in the file (see the table) |

## Device model: terminals

`module A_Mem_Code_Alpha(p, n, w_position)` has three terminals, all of the `electrical` discipline:

| Terminal | Direction | Meaning |
|---|---|---|
| `p` | input | positive device terminal; $V = V(p,n)$ |
| `n` | input | negative device terminal |
| `w_position` | output | voltage equal to the state $w$ (`V(w_position) <+ w`, line 92), for monitoring |

**Contributions:**
- Device current: `I(p,n) <+ I_total` (line 93).
- In the TCAM deck, `w_position` is tied to ground through a 1 GΩ resistor (`r_dummy`), so the node has a DC path.

## Device model: parameters

Values are as written in the `.va` file. Units are those stated in the file's comments; others are *to be added*.

| Name | Value | Units (from comment) | Comment in code | Python deterministic value |
|---|---|---|---|---|
| `kB` | 8.617e-5 | eV/K | Boltzmann constant | same |
| `T` | 300.0 | K | Temperature | same |
| `vt` | 0.026 | <span class="todo">to be added</span> | Thermal voltage | same |
| `q_charge` | 1.602e-19 | Coulombs | Elementary electron charge | 1.6e-19 |
| `alpha` | 5.3e18 | <span class="todo">to be added</span> | Barrier lowering coefficient | 5.357e18 (emp.), 5.0e18 (ab initio) |
| `k_attempt` | 1e12 | Hz | Attempt frequency | 6e12 |
| `v_off` | 0 | <span class="todo">to be added</span> | SET threshold | same |
| `v_on` | 0 | <span class="todo">to be added</span> | RESET threshold | same |
| `Eset` | 3.0 | eV | Activation Energy SET | 3.0 = `Eset_fp` |
| `Ereset` | 3.5 | eV | Activation Energy RESET | 3.5 = `Ereset_fp` |
| `Is` | 1.0e-10 | <span class="todo">to be added</span> | Schottky Saturation Current | 5.0e-9 |
| `n_set` | 16 | <span class="todo">to be added</span> | Ideality factor (SET) | 16.28 |
| `n_reset` | 15.0 | <span class="todo">to be added</span> | Ideality factor (RESET) | same |
| `G_metallic` | 0.05e-2 | <span class="todo">to be added</span> | Metallic conductance | same ($G_0$) |
| `w_init` | 0.0 | — | Starts in OFF State (Semiconducting) | same |
| `p_set` | 9.0 | — | Polynomial window for SET | same |
| `p_reset` | 0.8 | — | (no comment) | same |

**Fixed in the code body (not parameters):**
- State limits 0.001 / 0.999, used by the "anti-windup" check (lines 66–67).
- Hard clip to $[0,1]$ (lines 71–72).

## Device model: key equations

**SET / RESET rate** (lines 46–59), with $V = V(p,n)$:

$$
\frac{dw}{dt} = \begin{cases}
k_\mathrm{attempt}\exp\!\left[-\dfrac{E_\mathrm{set}-\alpha\,q\,V}{k_B T}\right]|1-w|^{p_\mathrm{set}}, & V > v_\mathrm{off}\\[2ex]
-k_\mathrm{attempt}\exp\!\left[-\dfrac{E_\mathrm{reset}-\alpha\,q\,|V|}{k_B T}\right]|w|^{p_\mathrm{reset}}, & V < v_\mathrm{on}\\[2ex]
0, & \text{otherwise (dead zone)}
\end{cases}
$$

**Anti-windup and integration** (lines 64–72):

$$
\text{window} = \begin{cases} 0, & w \ge 0.999 \text{ and } \dot w > 0\\ 0, & w \le 0.001 \text{ and } \dot w < 0\\ 1, & \text{otherwise}\end{cases}
\qquad
w = \int \dot w\cdot\text{window}\;dt \;\; (\texttt{idt}, \; w(0)=w_\mathrm{init}),\qquad w \leftarrow \min(\max(w,0),1)
$$

**Current** (lines 77–90):

$$
I_\mathrm{sch} = \begin{cases} I_s\big(e^{V/(n_\mathrm{set} v_t)}-1\big), & V\ge 0\\ -I_s\big(e^{|V|/(n_\mathrm{reset} v_t)}-1\big), & V<0\end{cases}
\qquad
I_\mathrm{met} = G_\mathrm{metallic}\,V,\qquad
I_\mathrm{total} = (1-w)\,I_\mathrm{sch} + w\,I_\mathrm{met}
$$

**Differences from the Python model:**
- **State handling:** the state is held by the simulator's `idt()` integrator, not by an explicit Euler loop.
- **State limits:** they are applied through the anti-windup window and the clip.
- **No current floor:** there is no current floor (none is needed in a circuit simulator).

## Notes for the author to check

- **Use of `w` before assignment:** `w` is read in the rate and window expressions (lines 49, 54, 66–67) before `w = idt(...)` assigns it (line 69). The code therefore relies on the simulator keeping `w` from the previous evaluation. This works in SmartSpice (author). Other Verilog-A compilers, such as OpenVAF for ngspice, may treat it differently.
- **The clip does not change the integrator:** the clip at lines 71–72 changes the variable `w`, not the value held inside `idt()`.
- **Include file names:** the include files are `constants.h` and `discipline.h`. Standard Verilog-A uses `constants.vams` and `disciplines.vams`, so other simulators may need these renamed.
- **No numerical limiting:** there is no `limexp()` or `$bound_step`. Convergence relies on the simulator options (`.options itl4=100 reltol=0.005` in the deck).

## TCAM circuit: architecture

`TCAM_new.in` defines one **3T1R TCAM cell**: three transistors and one memristor (subcircuit `TCAM_3T1R`, lines 12–18), together with a match-line precharge circuit.

```
            SLp                     SLr
             │                       │
     DLp ──┤ MP1 (PMOS, 10µ/180n)    ┴
             │                     [XR1]  memristor A_Mem_Code_Alpha (p = SLr, n = NX)
             ├───────── NX ──────────┘        └─ w_position → w1 ── r_dummy 1 GΩ ── GND
             │                │
     DLn ──┤ MN1 (NMOS, 10µ/180n)    └──┤ MNML (NMOS, 20µ/180n)
             │                              │
            SLn (0 V)              ML ──────┴────── GND

     VDD (1.8 V) ── M_PRE (PMOS, gate PRE_EN) ── ML ── C_ML 1 pF ── GND
```

| Element | Netlist line | Connection (drain gate source bulk) / value |
|---|---|---|
| `MP1` | 13 | `NX DLp SLp SLp`, PMOS, L = 180 nm, W = 10 µm |
| `MN1` | 14 | `NX DLn SLn SLn`, NMOS, L = 180 nm, W = 10 µm |
| `MNML` | 15 | `ML NX 0 0`, NMOS, L = 180 nm, W = 20 µm (match-line pull-down) |
| `XR1` | 16 | memristor between `SLr` (p) and `NX` (n); state output `w1` |
| `r_dummy` | 17 | 1 GΩ from `w1` to ground |
| `M_PRE` | 32 | `ML PRE_EN VDD VDD`, PMOS precharge |
| `C_ML` | 30 | 1 pF match-line capacitance |
| `V_VDD`, `V_SLn` | 24–25 | 1.8 V, 0 V |

The transistor models are generic Level-1 cards with **no parameters** (`.model nmos180 nmos level=1`, lines 6–7), so the simulator's default Level-1 values apply. No foundry process design kit (PDK) is used.

## TCAM circuit: operation sequence

The sequence is read from the piecewise-linear sources (lines 34–45). Transient analysis: `.tran 0.01m 7m`.

| Time (ms) | Phase | Bias (from the netlist) | Expected memristor action |
|---|---|---|---|
| 1 – 2 | **SET** write | DLn = 6 V (MN1 on, NX → SLn = 0 V), SLr = 4.5 V | +4.5 V across the memristor → $w \to 1$ |
| 2.2 – 2.4 | precharge | PRE_EN = 0 V → ML charged to VDD | — |
| 2.2 – 2.9 | **Search 1** | SLp = 1.8 V; DLp = 1.65 V during 2.4 – 2.8 | read |
| 3 – 4 | **RESET** write | DLp = 0 V (MP1 on), SLp = 4.5 V → NX high, SLr = 0 V | −4.5 V across the memristor → $w \to 0$ |
| 4.2 – 4.9 | **Search 2** | precharge 4.2 – 4.4; DLp = 1.65 V during 4.4 – 4.8 | read |
| 5 – 5.05 | **SET-M** (partial) write | DLn = 0.25 V (MN1 weakly on), SLr = 3.8 V | partial SET (intermediate $w$) |
| 6.2 – 6.9 | **Search 3** | precharge 6.2 – 6.4; DLp = 1.65 V during 6.4 – 6.8 | read |

*Interpretation (to be confirmed by the author):*
- **During a search:** MP1 (gate 1.65 V, source 1.8 V) and the memristor (to SLr = 0 V) form a divider at node NX. The memristor state therefore sets the NX voltage, and with it how strongly MNML discharges the precharged match line.
- **Ternary encoding:** the encoding of 0 / 1 / X ("don't care"), and the role of the partial SET-M state, are still to be documented by the author.

## TCAM circuit: simulation result (SmartSpice)

<figure>
<img src="frontend/assets/figures/TCAM_new_all.png" alt="SmartSpice transient waveforms of the 3T1R TCAM test bench" loading="lazy">
<figcaption><b>Author-supplied SmartSpice output</b> for <code>TCAM_new.in</code>; this is a real circuit simulation, not computed on this website. Panels, top to bottom: v(dln), v(dlp), v(ml), v(sln), v(slp), v(slr), v(x_tcam_1.nx) and the memristor state v(x_tcam_1.w1). The state goes to 1 at 1 ms (SET), returns to 0 at 3 ms (RESET), and settles at about 0.65 after the partial SET at 5 ms.</figcaption>
</figure>

## Running the circuit simulation

This website runs the **device equations** (in Python) but not the **circuit**.

**Option 1: SmartSpice.** This is what the author used. It is commercial (Silvaco), so a licence is required. Place `A_Mem_Code_Alpha.va` next to `TCAM_new.in` and run the deck; it loads the model through `.verilog "A_Mem_Code_Alpha.va"`.

**Option 2: open-source, untested.** This uses ngspice ≥ 39 with the OpenVAF Verilog-A compiler. The required changes:
1. Compile the model with `openvaf A_Mem_Code_Alpha.va`, which produces a `.osdi` file. The include names may need to change to `constants.vams` and `disciplines.vams`.
2. Replace `.verilog "…"` with a `pre_osdi` load in a `.control` block, and instantiate the device as an `N` element with a `.model … a_mem_code_alpha` line.
3. Check the behaviour of the use-before-assignment of `w` described in the notes above.
4. Replace `.plot`, `.print` and `.iplot` with ngspice `.control` / `plot` commands.

These steps have **not** been tested yet. The author's SmartSpice result is the reference.

**On this website:** running a full transistor-level simulation in the browser would need a SPICE engine compiled to WebAssembly plus a compiled Verilog-A model. This is possible in principle, but it is left for a later phase if needed.

## Source code

{{code src="original_code/A_Mem_Code_Alpha.va" lang="verilog" title="original_code/A_Mem_Code_Alpha.va (original, read-only)"}}

{{code src="original_code/TCAM_new.in" lang="plaintext" title="original_code/TCAM_new.in (original, read-only)"}}
