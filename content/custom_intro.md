# Simulate your own device

Run the energy-landscape model, or your own variant of it, with your parameter values and compare it with your measured data.

1. **Download the template** and change the values in `PARAMETERS`, and if needed the equations in `simulate()`. Or edit the code directly in the box below.
2. Press **Run code**. A control appears for every entry in `PARAMETERS`; entries with a `min` and `max` get a slider.
3. Optionally **upload your experimental I–V data**: a CSV or text file with two columns, voltage (V) and current (A).

The file must define `PARAMETERS` and a function `simulate(p)` that returns the voltage `V`, current `I` and, optionally, the state variable `w` and time `t`. The full rules are written at the top of the template.

> **Privacy:** your code and data never leave your computer. They run in your own browser, in an isolated Python environment, and nothing is uploaded to a server. If a simulation runs too long, press **Stop**.
