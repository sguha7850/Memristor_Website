"""
Publication-style plot of the 3T1R TCAM transient (white background, stacked
panels, one shared voltage axis label).

Data sources
  * Source voltages DLn, DLp, SLn, SLp, SLr: reconstructed EXACTLY from the
    PWL/DC definitions in the netlist (TCAM_new.in).
  * Node responses ML, NX and the memristor state w1: read from a SmartSpice
    data export (recommended, --data), or, for a preview only, from
    tcam_nodes_digitized.csv (digitized from the SmartSpice screenshot; the
    last ~0.8-1.2 ms of these three traces were hidden under the screenshot's
    legend boxes and are therefore missing).

Usage
  python plot_tcam_waveforms.py --netlist TCAM_new.in --data tcam_export.csv
  python plot_tcam_waveforms.py --netlist TCAM_new.in --digitized tcam_nodes_digitized.csv

The export file may be comma- or whitespace-separated, with a header row that
contains a time column ("time", in seconds) and the node columns named below
(case-insensitive). Edit NODE_COLUMNS if your simulator names them differently.
"""
import argparse
import csv
import re

import matplotlib.pyplot as plt
import numpy as np

NODE_COLUMNS = {           # trace -> column name in the simulator export
    "ML": "v(ml)",
    "NX": "v(x_tcam_1.nx)",
    "w1": "v(x_tcam_1.w1)",
}

# Panel order, labels and colours (top to bottom)
PANELS = [
    ("DLn", "V(DLn)", "#2ca02c"),
    ("DLp", "V(DLp)", "#d62728"),
    ("ML",  "V(ML)",  "#1f3fbf"),
    ("SLn", "V(SLn)", "#ff7f0e"),
    ("SLp", "V(SLp)", "#c71fc7"),
    ("SLr", "V(SLr)", "#0aa5b8"),
    ("NX",  "V(NX)",  "#8b4513"),
    ("w1",  "State variable", "#1f1fd6"),
]
T_END_MS = 7.0


def _num(s):
    """SPICE number with suffix (e.g. 2.19m, 10u) -> float."""
    m = re.fullmatch(r"([-+]?\d*\.?\d+(?:[eE][-+]?\d+)?)([a-zA-Z]*)", s)
    if not m:
        raise ValueError(s)
    scale = {"": 1, "t": 1e12, "g": 1e9, "meg": 1e6, "k": 1e3, "m": 1e-3,
             "u": 1e-6, "n": 1e-9, "p": 1e-12, "f": 1e-15}
    unit = m.group(2).lower()
    key = "meg" if unit.startswith("meg") else (unit[:1] if unit else "")
    return float(m.group(1)) * scale.get(key, 1)


def read_sources(netlist):
    """Return {name: (t_ms, v)} for the independent sources driving the cell."""
    out = {}
    text = open(netlist, encoding="utf-8", errors="ignore").read()
    for line in text.splitlines():
        line = line.strip()
        if not line.upper().startswith("V_"):
            continue
        name = line.split()[0][2:]                     # V_DLn -> DLn
        pwl = re.search(r"PWL\s*\(([^)]*)\)", line, re.I)
        if pwl:
            vals = [_num(v) for v in pwl.group(1).split()]
            t = np.array(vals[0::2]) * 1e3             # s -> ms
            v = np.array(vals[1::2])
        else:
            dc = re.search(r"DC\s+(\S+)", line, re.I)
            if not dc:
                continue
            t, v = np.array([0.0, T_END_MS]), np.full(2, _num(dc.group(1)))
        out[name] = (t, v)
    return out


def read_export(path):
    """Generic reader for a simulator export with a header row."""
    rows = [r for r in open(path, encoding="utf-8", errors="ignore").read().splitlines() if r.strip()]
    sep = "," if "," in rows[0] else None
    header = [h.strip().lower() for h in (rows[0].split(sep) if sep else rows[0].split())]
    data = []
    for r in rows[1:]:
        parts = r.split(sep) if sep else r.split()
        try:
            data.append([float(p) for p in parts])
        except ValueError:
            continue
    data = np.array(data)
    tcol = next(i for i, h in enumerate(header) if h.startswith("time"))
    t_ms = data[:, tcol] * 1e3
    out = {}
    for trace, col in NODE_COLUMNS.items():
        if col.lower() in header:
            out[trace] = (t_ms, data[:, header.index(col.lower())])
    return out


def read_digitized(path):
    out = {}
    with open(path) as fh:
        for row in csv.DictReader(fh):
            out.setdefault(row["node"], ([], []))
            out[row["node"]][0].append(float(row["time_ms"]))
            out[row["node"]][1].append(float(row["value"]))
    return {k: (np.array(t), np.array(v)) for k, (t, v) in out.items()}


def plot(traces, out_png, preview=False, t_end=T_END_MS):
    plt.rcParams.update({"font.size": 11, "font.family": "DejaVu Sans"})
    fig, axes = plt.subplots(len(PANELS), 1, figsize=(6.4, 9.2), sharex=True)
    for ax, (key, label, color) in zip(axes, PANELS):
        if key in traces:
            t, v = traces[key]
            ax.plot(t, v, color=color, lw=1.6)
            if preview and key in ("ML", "NX", "w1") and t.max() < t_end - 0.05:
                ax.axvspan(t.max(), t_end, color="0.9", lw=0)
                ax.text((t.max() + t_end) / 2, 0.5, "not\nreadable", transform=ax.get_xaxis_transform(),
                        ha="center", va="center", fontsize=7, color="0.45")
        ax.text(1.01, 0.5, label, transform=ax.transAxes, va="center", ha="left", color=color, fontsize=10)
        ax.set_xlim(0, t_end)
        ax.tick_params(direction="in", top=True, right=True, length=4, labelsize=10)
        ax.grid(False)
        if key == "SLn":
            ax.set_ylim(-0.5, 1.0)
            ax.set_yticks([0, 1])
        elif key == "w1":
            ax.set_ylim(-0.08, 1.12)
            ax.set_yticks([0, 0.5, 1])
        else:
            lo, hi = ax.get_ylim()
            ax.set_ylim(min(-0.3, lo), hi + 0.15 * (hi - lo))
    axes[-1].set_xlabel("Time (ms)", fontsize=12)
    axes[-1].set_ylabel("Reaction\ncoordinate", fontsize=11)
    # one voltage label for all voltage panels
    top = axes[0].get_position().y1
    bot = axes[-2].get_position().y0
    fig.text(0.015, (top + bot) / 2, "Voltage (V)", rotation=90, va="center", ha="left", fontsize=12)
    fig.subplots_adjust(left=0.13, right=0.82, top=0.98, bottom=0.07, hspace=0.12)
    fig.savefig(out_png, dpi=600, facecolor="white")
    print("saved", out_png)


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--netlist", default="TCAM_new.in")
    ap.add_argument("--data", help="SmartSpice export with ML, NX, w1 (recommended)")
    ap.add_argument("--digitized", default="tcam_nodes_digitized.csv")
    ap.add_argument("--out", default="TCAM_waveforms.png")
    ap.add_argument("--t-end", type=float, default=T_END_MS, help="end of the time axis in ms")
    a = ap.parse_args()
    traces = read_sources(a.netlist)
    if a.data:
        traces.update(read_export(a.data))
        plot(traces, a.out, t_end=a.t_end)
    else:
        traces.update(read_digitized(a.digitized))
        plot(traces, a.out, preview=True, t_end=a.t_end)
