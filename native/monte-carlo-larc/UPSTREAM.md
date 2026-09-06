# LArc Monte Carlo upstream

The LArc simulation engine in this directory was extracted from the UmaAi
`origin/LArc` branch at commit
`d69b0c815e7e9bad503a40f0783ebb24c2f981af`.

UmaShow-specific integration is implemented by `UmaShowLArcBridge.cpp` and
`CMakeLists.txt`. The bridge loads UmaShow's generated
`assets/data/monte_carlo.json`; no UmaAi `db` directory is required at build or
runtime.
