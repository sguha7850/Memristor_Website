# Simulate your own device

Use the energy-landscape model with your own device parameters and experimental data.

1. In the **model file** below, change only the **parameter values** (for example `Eset`, `Ereset`, `beta`, `k_attempt`, `Is`, `n_set`, `n_reset`, `G0`, the window exponents and the sweep settings).
2. Replace the arrays **`x_exp`** (voltage, V) and **`y_exp`** (current, A) with your measured I–V data.
3. Press **Run code**. The simulated I–V curve is plotted together with your data, along with the state variable against voltage.

You can also download the template, edit it on your computer and upload it with **Upload .py file**. In every case, **follow exactly the structure of the template**: keep all variable names unchanged, because the website reads `V_signal`, `current`, `state`, `x_exp` and `y_exp` from the file to draw the plots. Plotting commands in the file (`plt.show()`, `plt.savefig()`, …) are ignored on the website.

> **Privacy:** your code and data never leave your computer. They run in your own browser, in an isolated Python environment, and nothing is uploaded to a server. If a simulation runs too long, press **Stop**.
