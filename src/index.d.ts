import { type Superstate } from "./types.js";
export type { Superstate };

export type State<
  Name extends string,
  Context extends Superstate.Contexts.Constraint | null = null
> = Superstate.State<Name, Context>;

export const superstate: Superstate.Builder.Machine;
