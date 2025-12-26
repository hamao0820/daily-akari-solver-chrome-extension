// Akari solver ported from Rust to JavaScript

// State enum
const State = {
  Nil: 0,
  Empty: 1,
  Adj0: 2,
  Adj1: 3,
  Adj2: 4,
  Adj3: 5,
  Adj4: 6,
};

function stateFromString(s) {
  switch (s) {
    case "#":
      return State.Nil;
    case ".":
      return State.Empty;
    case "0":
      return State.Adj0;
    case "1":
      return State.Adj1;
    case "2":
      return State.Adj2;
    case "3":
      return State.Adj3;
    case "4":
      return State.Adj4;
    default:
      return State.Empty;
  }
}

function stateIsEmpty(state) {
  return state === State.Empty;
}

function stateIsAdj(state) {
  if (state >= State.Adj0 && state <= State.Adj4) {
    return state - State.Adj0;
  }
  return null;
}

// Field
class Field {
  constructor(h, w, fieldData) {
    this.h = h;
    this.w = w;
    this.field = fieldData;
  }

  static fromArray(problemData) {
    const h = problemData.length;
    const w = problemData[0].length;
    const field = problemData.map((row) => row.map((cell) => stateFromString(cell)));
    return new Field(h, w, field);
  }
}

// CellState enum
const CellState = {
  Unknown: 0,
  Light: 1,
  Blocked: 2,
};

// Segment
class Segment {
  constructor(cells) {
    this.cells = cells;
    this.light = null;
    this.free_cnt = cells.length;
  }
}

// NumCell
class NumCell {
  constructor(value, adj) {
    this.value = value;
    this.adj = adj;
    this.on = 0;
    this.unk = adj.length;
  }
}

// Action types for undo
const ActionType = {
  CellState: 0,
  RowLight: 1,
  ColLight: 2,
  RowFree: 3,
  ColFree: 4,
  LitCount: 5,
  NumOn: 6,
  NumUnk: 7,
};

// Core solver
class Core {
  constructor(field) {
    const h = field.h;
    const w = field.w;

    // Build empty cell list
    this.empty_pos = [];
    const empty_id = Array(h)
      .fill(null)
      .map(() => Array(w).fill(null));

    for (let r = 0; r < h; r++) {
      for (let c = 0; c < w; c++) {
        if (field.field[r][c] === State.Empty) {
          const id = this.empty_pos.length;
          this.empty_pos.push([r, c]);
          empty_id[r][c] = id;
        }
      }
    }

    this.n_empty = this.empty_pos.length;
    this.row_seg_id = new Array(this.n_empty).fill(0);
    this.col_seg_id = new Array(this.n_empty).fill(0);

    // Build row segments
    this.row_segs = [];
    for (let r = 0; r < h; r++) {
      let c = 0;
      while (c < w) {
        if (field.field[r][c] === State.Empty) {
          const cells = [];
          while (c < w && field.field[r][c] === State.Empty) {
            const id = empty_id[r][c];
            this.row_seg_id[id] = this.row_segs.length;
            cells.push(id);
            c++;
          }
          this.row_segs.push(new Segment(cells));
        } else {
          c++;
        }
      }
    }

    // Build column segments
    this.col_segs = [];
    for (let c = 0; c < w; c++) {
      let r = 0;
      while (r < h) {
        if (field.field[r][c] === State.Empty) {
          const cells = [];
          while (r < h && field.field[r][c] === State.Empty) {
            const id = empty_id[r][c];
            this.col_seg_id[id] = this.col_segs.length;
            cells.push(id);
            r++;
          }
          this.col_segs.push(new Segment(cells));
        } else {
          r++;
        }
      }
    }

    // Build numbered cells
    this.num_cells = [];
    this.num_adj_of_empty = Array(this.n_empty)
      .fill(null)
      .map(() => []);

    for (let r = 0; r < h; r++) {
      for (let c = 0; c < w; c++) {
        const value = stateIsAdj(field.field[r][c]);
        if (value !== null) {
          const adj = [];
          const neighbors = [
            [r - 1, c],
            [r + 1, c],
            [r, c - 1],
            [r, c + 1],
          ];
          for (const [nr, nc] of neighbors) {
            if (nr >= 0 && nr < h && nc >= 0 && nc < w && field.field[nr][nc] === State.Empty) {
              const id = empty_id[nr][nc];
              adj.push(id);
              this.num_adj_of_empty[id].push(this.num_cells.length);
            }
          }
          this.num_cells.push(new NumCell(value, adj));
        }
      }
    }

    // Build lit_list
    this.lit_list = [];
    for (let id = 0; id < this.n_empty; id++) {
      const list = [...this.row_segs[this.row_seg_id[id]].cells];
      for (const x of this.col_segs[this.col_seg_id[id]].cells) {
        if (!list.includes(x)) {
          list.push(x);
        }
      }
      this.lit_list.push(list);
    }

    this.lit_count = new Array(this.n_empty).fill(0);
    this.cell_state = new Array(this.n_empty).fill(CellState.Unknown);
    this.trail = [];
  }

  toSolution(field) {
    const grid = Array(field.h)
      .fill(null)
      .map(() => Array(field.w).fill(false));
    for (let id = 0; id < this.empty_pos.length; id++) {
      if (this.cell_state[id] === CellState.Light) {
        const [r, c] = this.empty_pos[id];
        grid[r][c] = true;
      }
    }
    return grid;
  }

  checkpoint() {
    return this.trail.length;
  }

  undo(cp) {
    while (this.trail.length > cp) {
      const action = this.trail.pop();
      switch (action.type) {
        case ActionType.CellState:
          this.cell_state[action.idx] = action.prev;
          break;
        case ActionType.RowLight:
          this.row_segs[action.seg].light = action.prev;
          break;
        case ActionType.ColLight:
          this.col_segs[action.seg].light = action.prev;
          break;
        case ActionType.RowFree:
          this.row_segs[action.seg].free_cnt = action.prev;
          break;
        case ActionType.ColFree:
          this.col_segs[action.seg].free_cnt = action.prev;
          break;
        case ActionType.LitCount:
          this.lit_count[action.idx] = action.prev;
          break;
        case ActionType.NumOn:
          this.num_cells[action.idx].on = action.prev;
          break;
        case ActionType.NumUnk:
          this.num_cells[action.idx].unk = action.prev;
          break;
      }
    }
  }

  setBlocked(cell, q_num) {
    if (this.cell_state[cell] === CellState.Blocked) return true;
    if (this.cell_state[cell] === CellState.Light) return false;

    this.trail.push({ type: ActionType.CellState, idx: cell, prev: CellState.Unknown });
    this.cell_state[cell] = CellState.Blocked;

    const rseg = this.row_seg_id[cell];
    const prev_row = this.row_segs[rseg].free_cnt;
    this.trail.push({ type: ActionType.RowFree, seg: rseg, prev: prev_row });
    this.row_segs[rseg].free_cnt -= 1;

    const cseg = this.col_seg_id[cell];
    const prev_col = this.col_segs[cseg].free_cnt;
    this.trail.push({ type: ActionType.ColFree, seg: cseg, prev: prev_col });
    this.col_segs[cseg].free_cnt -= 1;

    for (const idx of this.num_adj_of_empty[cell]) {
      const prev_unk = this.num_cells[idx].unk;
      this.trail.push({ type: ActionType.NumUnk, idx, prev: prev_unk });
      this.num_cells[idx].unk -= 1;
      q_num.push(idx);
    }

    return true;
  }

  setLight(cell, q_num) {
    if (this.cell_state[cell] === CellState.Light) return true;
    if (this.cell_state[cell] === CellState.Blocked) return false;

    this.trail.push({ type: ActionType.CellState, idx: cell, prev: CellState.Unknown });
    this.cell_state[cell] = CellState.Light;

    for (const lit of this.lit_list[cell]) {
      const prev = this.lit_count[lit];
      this.trail.push({ type: ActionType.LitCount, idx: lit, prev });
      this.lit_count[lit] = prev + 1;
    }

    for (const idx of this.num_adj_of_empty[cell]) {
      const prev_on = this.num_cells[idx].on;
      this.trail.push({ type: ActionType.NumOn, idx, prev: prev_on });
      this.num_cells[idx].on = prev_on + 1;

      const prev_unk = this.num_cells[idx].unk;
      this.trail.push({ type: ActionType.NumUnk, idx, prev: prev_unk });
      this.num_cells[idx].unk = prev_unk - 1;
      q_num.push(idx);
    }

    const rseg = this.row_seg_id[cell];
    const row_light = this.row_segs[rseg].light;
    if (row_light !== null && row_light !== cell) return false;
    if (row_light === null) {
      this.trail.push({ type: ActionType.RowLight, seg: rseg, prev: null });
      this.row_segs[rseg].light = cell;
      const cells = [...this.row_segs[rseg].cells];
      for (const other of cells) {
        if (other !== cell && !this.setBlocked(other, q_num)) {
          return false;
        }
      }
    }

    const cseg = this.col_seg_id[cell];
    const col_light = this.col_segs[cseg].light;
    if (col_light !== null && col_light !== cell) return false;
    if (col_light === null) {
      this.trail.push({ type: ActionType.ColLight, seg: cseg, prev: null });
      this.col_segs[cseg].light = cell;
      const cells = [...this.col_segs[cseg].cells];
      for (const other of cells) {
        if (other !== cell && !this.setBlocked(other, q_num)) {
          return false;
        }
      }
    }

    return true;
  }

  propagate() {
    const q_num = Array.from({ length: this.num_cells.length }, (_, i) => i);

    while (true) {
      let changed = false;

      while (q_num.length > 0) {
        const idx = q_num.shift();
        const { on, unk, value } = this.num_cells[idx];

        if (on > value || on + unk < value) {
          return false;
        }

        if (on === value) {
          const adj = [...this.num_cells[idx].adj];
          for (const cell of adj) {
            if (this.cell_state[cell] === CellState.Unknown) {
              if (!this.setBlocked(cell, q_num)) {
                return false;
              }
              changed = true;
            }
          }
        } else if (on + unk === value) {
          const adj = [...this.num_cells[idx].adj];
          for (const cell of adj) {
            if (this.cell_state[cell] === CellState.Unknown) {
              if (!this.setLight(cell, q_num)) {
                return false;
              }
              changed = true;
            }
          }
        }
      }

      for (let cell = 0; cell < this.n_empty; cell++) {
        if (this.lit_count[cell] > 0) continue;

        const rseg = this.row_seg_id[cell];
        const cseg = this.col_seg_id[cell];

        if (this.row_segs[rseg].light !== null || this.col_segs[cseg].light !== null) {
          continue;
        }

        const row_free = this.row_segs[rseg].free_cnt;
        const col_free = this.col_segs[cseg].free_cnt;
        const self_free = this.cell_state[cell] !== CellState.Blocked ? 1 : 0;
        const cand = row_free + col_free - self_free;

        if (cand === 0) {
          return false;
        }
        if (cand === 1) {
          const pos = this.findSingleCandidate(rseg, cseg);
          if (pos !== null) {
            if (!this.setLight(pos, q_num)) {
              return false;
            }
            changed = true;
          } else {
            return false;
          }
        }
      }

      if (!changed && q_num.length === 0) {
        break;
      }
    }

    return true;
  }

  findSingleCandidate(rseg, cseg) {
    let only = null;
    for (const cell of this.row_segs[rseg].cells) {
      if (this.cell_state[cell] !== CellState.Blocked) {
        if (only !== null && only !== cell) {
          return null;
        }
        only = cell;
      }
    }
    for (const cell of this.col_segs[cseg].cells) {
      if (this.cell_state[cell] !== CellState.Blocked) {
        if (only !== null && only !== cell) {
          return null;
        }
        only = cell;
      }
    }
    return only;
  }

  isSolved() {
    if (this.lit_count.some((v) => v === 0)) {
      return false;
    }
    return this.num_cells.every((n) => n.on === n.value);
  }

  chooseBranchCell() {
    let best = null;

    for (let cell = 0; cell < this.n_empty; cell++) {
      if (this.lit_count[cell] > 0) continue;

      const rseg = this.row_seg_id[cell];
      const cseg = this.col_seg_id[cell];
      if (this.row_segs[rseg].light !== null || this.col_segs[cseg].light !== null) {
        continue;
      }

      const row_free = this.row_segs[rseg].free_cnt;
      const col_free = this.col_segs[cseg].free_cnt;
      const self_free = this.cell_state[cell] !== CellState.Blocked ? 1 : 0;
      const cand_count = row_free + col_free - self_free;

      if (cand_count <= 1) continue;

      const candidates = [];
      for (const x of this.row_segs[rseg].cells) {
        if (this.cell_state[x] !== CellState.Blocked) {
          candidates.push(x);
        }
      }
      for (const x of this.col_segs[cseg].cells) {
        if (this.cell_state[x] !== CellState.Blocked && !candidates.includes(x)) {
          candidates.push(x);
        }
      }

      if (best === null || cand_count < best.count) {
        best = { count: cand_count, candidates };
      }
    }

    return best ? best.candidates : null;
  }

  dfs() {
    if (!this.propagate()) {
      return false;
    }
    if (this.isSolved()) {
      return true;
    }

    const candidates = this.chooseBranchCell();
    if (!candidates) {
      return false;
    }

    for (const pos of candidates) {
      const cp = this.checkpoint();
      const q = [];
      if (this.setLight(pos, q) && this.dfs()) {
        return true;
      }
      this.undo(cp);
    }

    return false;
  }
}

// Fast solver
class FastSolver {
  solve(field) {
    const core = new Core(field);
    if (core.dfs()) {
      return core.toSolution(field);
    }
    return null;
  }
}

// Export for use
function solveAkari(problemData) {
  const field = Field.fromArray(problemData);
  const solver = new FastSolver();
  const solution = solver.solve(field);

  if (solution) {
    // Convert solution grid to list of positions
    const positions = [];
    for (let r = 0; r < solution.length; r++) {
      for (let c = 0; c < solution[r].length; c++) {
        if (solution[r][c]) {
          positions.push([r, c]);
        }
      }
    }
    return { solution: positions };
  }

  return null;
}

// For use in content script or service worker
if (typeof module !== "undefined" && module.exports) {
  module.exports = { solveAkari };
}
