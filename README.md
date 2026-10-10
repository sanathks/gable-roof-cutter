# Gable Roof Cutter

Calculator for a purlin gable roof on four posts: 3D model, cut list, cut drawings for every piece,
and STL files for a scale model. Live at https://sanathks.github.io/gable-roof-cutter/

## Tests

All calculation code lives in one block of `index.html`. The tests load that block and check its
results with independent geometry: lengths and angles measured on the shapes the code produces,
notches checked against the beams they sit on, STL files checked for closed solids and volume,
and 400 random roofs.

```bash
node --test tests/geometry.test.js
```
