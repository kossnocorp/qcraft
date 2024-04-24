/**
 * The root Superstate namespace. It contains all the Superstate types.
 */
export namespace Superstate {
  /**
   * Temp namespace.
   */
  export namespace QQ {
    export type AnyTransition<
      EventName extends string = string,
      MachineStateName extends string = string,
      FromStateName extends MachineStateName = MachineStateName
    > = Transitions.Transition<
      EventName,
      FromStateName,
      any,
      string | null,
      Transitions.Action | null
    >;

    export type AnyMachineFactory<MachineState extends States.AnyState = any> =
      Factories.MachineFactory<MachineState>;

    export interface Off {
      (): void;
    }

    export type OnTarget<
      FlatState extends FlatStateConstraint,
      FlatEvent extends FlatEventConstraint
    > =
      | "*"
      | (true extends FlatState["nested"] ? "**" : never)
      | StateTarget<FlatState>
      | FlatState["wildcard"]
      | EventTarget<FlatEvent>;

    export type StateTarget<FlatState extends FlatStateConstraint> =
      FlatState["key"];

    export type MatchTargetState<
      FlatState extends FlatStateConstraint,
      Target extends string
    > = FlatState extends { key: Target } ? FlatState["state"] : never;

    export type EventTarget<FlatEvent extends FlatEventConstraint> =
      FlatEvent extends {
        key: infer Key extends string;
        condition: infer Condition extends string | null;
      }
        ? `${Key}(${Condition extends null ? "" : Condition})`
        : never;

    export type MatchTargetEvent<
      FlatEvent extends FlatEventConstraint,
      Target extends string
    > = Target extends `${infer Key}()`
      ? FlatEvent extends { key: Key }
        ? FlatEvent["event"]
        : never
      : never;

    export type DeepWildcardEvent<
      FlatState extends FlatStateConstraint,
      FlatEvent extends FlatEventConstraint
    > = StateUpdate<FlatState["state"]> | EventUpdate<FlatEvent["event"]>;

    type WildcardConstraint = `${string}*`;

    export type WildcardEvent<
      FlatState extends FlatStateConstraint,
      FlatEvent extends FlatEventConstraint,
      Target extends WildcardConstraint
    > =
      | (FlatState extends { wildcard: Target }
          ? StateUpdate<FlatState["state"]>
          : never)
      | (FlatEvent extends { wildcard: Target }
          ? EventUpdate<FlatEvent["event"]>
          : never);

    export interface StateUpdate<_State extends { name: string }> {
      type: "state";
      state: _State;
    }

    export interface EventUpdate<Transition> {
      type: "event";
      transition: Transition;
    }

    export interface OnListener<
      FlatState extends FlatStateConstraint,
      FlatEvent extends FlatEventConstraint,
      Target extends OnTarget<FlatState, FlatEvent> // TODO: Simplify it
    > {
      (
        target: Target extends "**"
          ? DeepWildcardEvent<FlatState, FlatEvent>
          : Target extends WildcardConstraint
          ? WildcardEvent<FlatState, FlatEvent, Target>
          : Target extends
              | Array<infer TargetString extends string>
              | infer TargetString extends string
          ? MatchTargetState<FlatState, TargetString> extends infer MatchedState
            ? MatchTargetEvent<
                FlatEvent,
                TargetString
              > extends infer MatchedEvent
              ?
                  | (MatchedState extends { name: string }
                      ? StateUpdate<MatchedState>
                      : never)
                  | (MatchedEvent extends never
                      ? never
                      : EventUpdate<MatchedEvent>)
              : never
            : never
          : never
      ): void;
    }

    export type MatchNextState<
      MachineState extends States.AnyState, // TODO: Cut it
      AllState extends States.AnyState, // TODO: Cut it
      EventName,
      EventCondition extends string | null
    > = MachineState extends { transitions: Array<infer Event> }
      ? Event extends {
          event: EventName;
          condition: EventCondition;
          to: infer ToName;
        }
        ? States.FilterState<AllState, ToName>
        : never
      : never;

    export interface FlatEventConstraint {
      key: string;
      wildcard: WildcardConstraint;
      condition: string | null;
      final: boolean;
      next: States.AnyState;
      event: AnyTransition;
      nested: boolean;
      context: Contexts.Constraint | null;
    }

    export interface FlatStateConstraint {
      key: string;
      wildcard: WildcardConstraint;
      state: States.AnyState;
      nested: boolean;
    }

    export type DeepFlatEvent<
      MachineState extends States.AnyState,
      AllState extends States.AnyState,
      Prefix extends string | "" = ""
    > =
      // First we get the root level events
      | (MachineState extends {
          transitions: Array<infer Event>;
        }
          ? Event extends {
              event: infer EventName extends string;
              condition: infer Condition extends string | null;
              from: infer FromName extends string;
            }
            ? MatchNextState<
                AllState,
                AllState,
                EventName,
                Condition
              > extends infer NextState
              ? NextState extends { name: infer NextStateName extends string }
                ? {
                    [Name in NextStateName]: {
                      key: `${Prefix}${EventName}`;
                      wildcard: `${Prefix}*`;
                      condition: Condition;
                      event: Event;
                      next: NextState;
                      final: false;
                      nested: Prefix extends "" ? false : true;
                      context: Contexts.EventContext<
                        AllState,
                        FromName,
                        NextState
                      >;
                    };
                  }[NextStateName]
                : never
              : never
            : never
          : never)
      // Now we add the substate events
      | (MachineState extends {
          name: infer StateName extends string;
          sub: infer Substates extends Record<string, any>;
        }
          ? // Here we prevent the infinite recursion when Substates is uknown and
            // keyof Substates resolves to `string | number | symbol`:
            // > Type instantiation is excessively deep and possibly infinite.
            keyof Substates extends string
            ? {
                [SubstateName in keyof Substates]: Substates[SubstateName] extends {
                  sub: infer AsSubstate;
                  state: infer SubstateState extends States.AnyState;
                }
                  ? SubstateName extends string
                    ?
                        | DeepFlatEvent<
                            SubstateState,
                            SubstateState,
                            `${Prefix}${StateName}.${SubstateName}.`
                          >
                        // Add final transitions
                        | (AsSubstate extends Substate<
                            any,
                            any,
                            infer Transition
                          >
                            ? Transition extends SubstateFinalTransition<
                                infer EventName,
                                any,
                                any
                              >
                              ? {
                                  key: `${Prefix}${EventName}`;
                                  wildcard: `${Prefix}*`;
                                  event: Transition;
                                  condition: null;
                                  next: MatchNextState<
                                    AllState,
                                    AllState,
                                    EventName,
                                    null
                                  >;
                                  final: true;
                                  nested: true;
                                  context: null; // TODO: context
                                }
                              : never
                            : never)
                    : never
                  : never;
              }[keyof Substates]
            : never
          : never);

    export type DeepFlatState<
      MachineState extends States.AnyState,
      Prefix extends string | "" = ""
    > =
      // First we get the root level states
      | (MachineState extends {
          name: infer Name extends string;
        }
          ? {
              key: `${Prefix}${Name}`;
              wildcard: `${Prefix}*`;
              state: MachineState;
              nested: Prefix extends "" ? false : true;
            }
          : never)
      // Now we add the substates
      | (MachineState extends {
          name: infer StateName extends string;
          sub: infer Substates extends Record<string, any>;
        }
          ? // Here we prevent the infinite recursion when Substates is uknown and
            // keyof Substates resolves to `string | number | symbol`:
            // > Type instantiation is excessively deep and possibly infinite.
            keyof Substates extends string
            ? {
                [SubstateName in keyof Substates]: Substates[SubstateName] extends {
                  state: infer SubstateState extends States.AnyState;
                }
                  ? SubstateName extends string
                    ? DeepFlatState<
                        SubstateState,
                        `${Prefix}${StateName}.${SubstateName}.`
                      >
                    : never
                  : never;
              }[keyof Substates]
            : never
          : never);

    export interface MachineInstance<
      MachineState,
      FlatState extends FlatStateConstraint,
      FlatEvent extends FlatEventConstraint,
      AsSubstate
    > {
      readonly sub: AsSubstate;

      readonly state: MachineState;

      readonly finalized: boolean;

      send<
        Key extends FlatEvent extends {
          key: infer Key extends string;
          condition: null;
          final: false;
        }
          ? Key
          : never,
        ToStateName extends FlatEvent extends {
          key: Key;
          condition: null;
          final: false;
          next: { name: infer StateName extends string };
        }
          ? StateName
          : never,
        Context extends FlatEvent extends {
          key: Key;
          condition: null;
          final: false;
          context: infer Context;
          next: { name: ToStateName };
        }
          ? Context
          : never
      >(
        name: `${Key}() -> ${ToStateName}`,
        context: NoInfer<Context>
      ): FlatEvent extends {
        key: Key;
        condition: null;
        next: infer Next;
      }
        ? Next | null
        : never;

      send<
        Key extends FlatEvent extends {
          key: infer Key extends string;
          condition: null;
          context: null;
          final: false;
        }
          ? Key
          : never
      >(
        name: `${Key}()`
      ): FlatEvent extends {
        key: Key;
        condition: null;
        context: null;
        next: infer Next;
      }
        ? Next | null
        : never;

      send<
        Key extends FlatEvent extends {
          key: infer Key extends string;
          final: false;
          condition: string;
          context: null;
        }
          ? Key
          : never,
        Condition extends FlatEvent extends {
          key: Key;
          condition: infer Condition extends string;
          context: null;
        }
          ? Condition
          : null
      >(
        name: `${Key}()`,
        condition: Condition
      ): FlatEvent extends {
        key: Key;
        condition: Condition;
        context: null;
        next: infer Next;
      }
        ? Next | null
        : never;

      send<
        Key extends FlatEvent extends {
          key: infer Key extends string;
          final: false;
        }
          ? Key
          : never,
        Condition extends FlatEvent extends {
          key: Key;
          condition: infer Condition;
        }
          ? Condition
          : null
      >(
        name: Condition extends string ? `${Key}(${Condition})` : never
      ): FlatEvent extends {
        key: Key;
        condition: Condition;
        next: infer Next;
      }
        ? Next | null
        : never;

      on<Target extends OnTarget<FlatState, FlatEvent>>(
        target: Target | Target[],
        listener: OnListener<FlatState, FlatEvent, Target>
      ): Off;

      in<Target extends StateTarget<FlatState>>(
        target: Target | Target[]
      ): MatchTargetState<FlatState, Target> | undefined;

      off(): void;
    }

    export type EventDef<
      MachineStateName extends string,
      EventName extends string,
      Condition extends string
    > =
      | `${EventName}() -> ${MachineStateName}`
      | `${EventName}(${Condition}) -> ${MachineStateName}`;

    /**
     * Infers the entry state name from the machine state.
     */
    export type EntryStateName<State> = State extends {
      name: infer Name;
      props: { entry: true };
    }
      ? Name
      : never;

    export type BuilderChainState<
      MachineStateName extends string,
      StateName extends MachineStateName,
      StateAction extends Superstate.Actions.Action,
      StateDef_ extends Superstate.States.Def<MachineStateName>,
      Substate extends Substates.AnySubstate,
      Initial extends boolean,
      Final extends boolean,
      Context
    > = {
      name: StateName;
      actions: Array<
        | (StateDef_ extends Superstate.Actions.Def
            ? Superstate.Actions.FromDef<StateDef_>
            : never)
        | StateAction
      >;
      transitions: Transitions.FromDef<
        MachineStateName,
        StateName,
        StateDef_ extends EventDef<any, any, any> ? StateDef_ : never
      >[];
      sub: Substates.BuilderSubstatesMap<Substate>;
      initial: Initial;
      final: Final;
      [Contexts.ContextBrand]: Context;
    };

    export interface SubstateFinalTransition<
      EventName extends string,
      ChildFromStateName extends string,
      MachineToStateName extends string
    > {
      event: EventName;
      from: ChildFromStateName;
      to: MachineToStateName;
      condition: null;
    }

    export interface Substate<Name, Factory, Transition> {
      name: Name;
      factory: Factory;
      transitions: Transition[];
    }

    export type SubstateFinalTransitionDef<
      ParentMachineName extends string,
      ChildFinalStateName extends string,
      TransitionName extends string
    > = `${ChildFinalStateName} -> ${TransitionName}() -> ${ParentMachineName}`;

    export type SubstateFinalTransitionFromDef<
      Def extends SubstateFinalTransitionDef<any, any, any>
    > =
      Def extends `${infer ChildFromStateName} -> ${infer EventName}() -> ${infer MachineToStateName}`
        ? {
            event: EventName;
            from: ChildFromStateName;
            to: MachineToStateName;
            condition: null;
          }
        : never;
  }

  /**
   * The actions namespace. It contains all the types related to actions,
   * the entity that defines invoked function when entering or exiting a state
   * or transitioning between states.
   */
  export namespace Actions {
    /**
     * The action name definition.
     */
    export type NameDef = `${string}!`;

    /**
     * The action definition.
     */
    export type Def = EnterDef | ExitDef;

    /**
     * The enter action definition.
     */
    export type EnterDef = `-> ${string}!`;

    /**
     * The exit action definition.
     */
    export type ExitDef = `${string}! ->`;

    /**
     * The action type.
     */
    export type Type = "enter" | "exit";

    /**
     * Resolves action struct from an action name def.
     */
    export type FromNameDef<Type, Def> = Def extends `${infer Name}!`
      ? { type: Type; name: Name }
      : never;

    /**
     * Resolves action struct from an action def.
     */
    export type FromDef<Def> = Def extends `-> ${infer Name}!`
      ? { type: "enter"; name: Name }
      : Def extends `${infer Name}! ->`
      ? { type: "exit"; name: Name }
      : never;

    /**
     * The action struct.
     */
    export interface Action {
      /** The action type. */
      type: Type;
      /** The action name. */
      name: string;
    }

    /**
     * The binding function type.
     */
    export type BindingFn = () => void;

    /**
     * The type resolves arguments for the binding functions to actions. It's
     * used to create a host.
     */
    export type BindingArgs<State extends { name: string }> =
      true extends HasBindingArgs<State>
        ? [
            Binding<State> extends infer Binding_ extends BindingConstraint
              ? BindingMap<Contexts.InitialContext<State>, Binding_>
              : never
          ]
        : [];

    export type HasBindingArgs<State> = true extends IsActionable<State>
      ? true
      : true extends Contexts.HasInitialContext<State>
      ? true
      : false;

    export type BindingMap<
      InitialContext,
      Binding_ extends BindingConstraint
    > = Utils.OmitNever<
      { context: InitialContext } & {
        [StateName in Binding_["state"]]: {
          [Key in Binding_ extends { state: StateName }
            ? Binding_["key"]
            : never]: Binding_ extends {
            sub: infer SubstateBinding extends BindingConstraint;
          }
            ? BindingMap<never, SubstateBinding>
            : BindingFn;
        };
      }
    >;

    /**
     * The binding constrain type.
     */
    export type BindingConstraint =
      | BindingConstraintAction
      | BindingConstraintSubstate;

    /**
     * The binding constrain action type.
     */
    export interface BindingConstraintAction {
      key: string;
      state: string;
    }

    /**
     * The binding constrain substate type.
     */
    export interface BindingConstraintSubstate {
      key: string;
      state: string;
      sub: BindingConstraint[];
    }

    /**
     * Resolves action bindings.
     */
    export type Binding<State extends { name: string }> = State extends {
      name: infer StateName;
      actions: Array<infer Action>;
      transitions: Array<infer Transition>;
      sub: Record<string, infer Substate>;
    }
      ? // Get all state actions

        | (Action extends {
              name: infer ActionName extends string;
              type: infer Type;
            }
              ? {
                  state: StateName;
                  key: Type extends "enter"
                    ? `-> ${ActionName}!`
                    : `${ActionName}! ->`;
                }
              : never)
          // Get all state transitions actions
          | (Transition extends {
              event: infer EventName extends string;
              action: { name: infer ActionName extends string };
              condition: infer Condition;
            }
              ? {
                  state: StateName;
                  key: `${EventName}(${Condition extends string
                    ? Condition
                    : ""}) -> ${ActionName}!`;
                }
              : never)
          // Get all substates
          | (Substate extends {
              sub: { name: infer SubstateName };
              state: infer SubstateState extends States.AnyState;
            }
              ? true extends IsActionable<SubstateState>
                ? {
                    key: SubstateName;
                    state: StateName;
                    sub: Binding<SubstateState>;
                  }
                : never
              : never)
      : never;

    /**
     * The type resolves true if any state has at least one action.
     * It will resolve `boolean` when some states have no actions.
     */
    export type IsActionable<State> = State extends {
      transitions: Array<
        infer Transition extends {
          action: Superstate.Transitions.Action | null;
        }
      >;
      actions: Array<infer Action extends { name: string }>;
      sub: infer Substates;
    }
      ? // Are there any state or transition actions?
        | (Action["name"] extends never
              ? Transition["action"] extends null
                ? false
                : true
              : true)
          // Any there substate actions?
          | (keyof Substates extends never
              ? false
              : Substates[keyof Substates] extends {
                  state: infer SubstateState;
                }
              ? IsActionable<SubstateState>
              : never)
      : never;
  }

  /**
   * The events namespace. It contains all the types related to events,
   * the entity that trigger state transitions.
   */
  export namespace Events {}

  /**
   * The transitions namespace. It contains all the types related to
   * transitions, the entity that defines the state transition triggered
   * by events.
   */
  export namespace Transitions {
    /**
     * The transition type placeholder. It's used where the shape of
     * a transition isn't important or known.
     */
    export type AnyTransition = Transition<any, any, any, any, any>;

    export interface Transition<
      EventName,
      FromStateName,
      ToStateName,
      Condition,
      Action
    > {
      event: EventName;
      condition: Condition;
      from: FromStateName;
      to: ToStateName;
      action: Action;
    }

    /**
     * Any transition def.
     */
    export type Def<MachineStateName extends string> =
      | EventDef<MachineStateName>
      | EventDefWithAction<MachineStateName>;

    /**
     * The transition def.
     */
    export type EventDef<
      MachineStateName extends string,
      EventName extends string = string,
      Condition extends string | "" = string | ""
    > = `${EventName}(${Condition}) -> ${MachineStateName}`;

    /**
     * The transition def with action.
     */
    export type EventDefWithAction<
      MachineStateName extends string,
      EventName extends string = string,
      Condition extends string | "" = string | "",
      Action extends string = string
    > = `${EventName}(${Condition}) -> ${Action}! -> ${MachineStateName}`;

    /**
     * Ant transition case def.
     */
    export type CaseDef<MachineStateName extends string> =
      | EventCaseDef<MachineStateName>
      | EventCaseDefWithAction<MachineStateName>;

    /**
     * The transition case def.
     */
    export type EventCaseDef<
      MachineStateName extends string,
      Condition extends string | "" = string | ""
    > = `(${Condition}) -> ${MachineStateName}`;

    /**
     * The transition case def.
     */
    export type EventCaseDefWithAction<
      MachineStateName extends string,
      Condition extends string | "" = string | "",
      Action extends string = string
    > = `(${Condition}) -> ${Action}! -> ${MachineStateName}`;

    /**
     * Resolves the event case def to the event def.
     */
    export type CaseDefToDef<
      MachineStateName extends string,
      EventName extends string,
      Def_ extends CaseDef<MachineStateName>
    > = Def_ extends Def_
      ? // TODO: Try to optimize it to `${EventName}${Def}`
        Def_ extends EventCaseDef<
          infer ToState extends MachineStateName,
          infer Condition
        >
        ? `${EventName}(${Condition}) -> ${ToState}`
        : Def_ extends EventCaseDefWithAction<
            infer ToState extends MachineStateName,
            infer Condition,
            infer Action
          >
        ? `${EventName}(${Condition}) -> ${Action}! -> ${ToState}`
        : never
      : never;

    /**
     * The transition action.
     */
    export interface Action {
      /** The action type. */
      type: "transition";
      /** The action name. */
      name: string;
    }

    export type FromDef<
      MachineStateName extends string,
      FromStateName extends MachineStateName,
      Def_ extends Def<MachineStateName>
    > = Def_ extends Transitions.EventDef<
      infer ToStateName extends MachineStateName,
      infer EventName,
      infer Condition
    >
      ? Transition<
          EventName,
          FromStateName,
          ToStateName,
          Condition extends "" ? null : Condition,
          null
        >
      : Def_ extends Transitions.EventDefWithAction<
          infer ToStateName extends MachineStateName,
          infer EventName,
          infer Condition,
          infer Action
        >
      ? Transition<
          EventName,
          FromStateName,
          ToStateName,
          Condition extends "" ? null : Condition,
          { type: "transition"; name: Action }
        >
      : never;
  }

  export namespace States {
    export interface State<StateName, Action, Transition, Substates_, Final> {
      name: StateName;
      actions: Action[];
      transitions: Transition[];
      sub: Substates_;
      final: Final;
    }

    /**
     * The state def.
     */
    export type Def<MachineStateName extends string> =
      | Transitions.Def<MachineStateName>
      | Actions.Def;

    /**
     * The state type placeholder. It's used where the shape of a state isn't
     * important or known.
     */
    export type AnyState = State<any, any, any, any, any>;

    export type BuilderStateToInstance<State extends AnyState> = State extends {
      sub: Substates.BuilderSubstatesMap<infer Substate>;
    }
      ? State & { sub: Substates.InstanceSubstatesMap<Substate> }
      : never;

    export type BuilderState = State<
      any,
      any,
      any,
      Substates.BuilderSubstatesMap<any>,
      any
    >;

    /**
     * Filters out the state by the state name.
     */
    export type FilterState<State, Name> = State extends { name: Name }
      ? State
      : never;
  }

  export namespace Builder {
    export interface Machine {
      <MachineStateName extends string>(name: string): Head<MachineStateName>;
    }

    export interface Head<
      MachineStateName extends string,
      ChainStateName extends MachineStateName = MachineStateName,
      MachineState extends States.AnyState = never
    > {
      state: StateFn<
        true,
        false,
        MachineStateName,
        ChainStateName,
        MachineState
      >;
    }

    export interface Tail<
      MachineStateName extends string,
      ChainStateName extends MachineStateName = MachineStateName,
      MachineState extends States.AnyState = never
    > {
      state: StateFn<
        false,
        false,
        MachineStateName,
        ChainStateName,
        MachineState
      >;

      final: StateFn<
        false,
        true,
        MachineStateName,
        ChainStateName,
        MachineState
      >;
    }

    export interface StateFnGeneratorBuilder<
      MachineStateName extends string,
      StateAction extends Actions.Action = never,
      StateTransitionDef extends Transitions.Def<MachineStateName> = never,
      Substate extends Substates.AnySubstate = never,
      Context = never
    > {
      context<AssignedContext>(): StateFnGeneratorBuilder<
        MachineStateName,
        StateAction,
        StateTransitionDef,
        Substate,
        AssignedContext
      >;

      enter<ActionNameDef extends Actions.NameDef>(
        name: ActionNameDef
      ): StateFnGeneratorBuilder<
        MachineStateName,
        StateAction | Actions.FromNameDef<"enter", ActionNameDef>,
        StateTransitionDef,
        Substate,
        Context
      >;

      exit<NameDef extends Actions.NameDef>(
        name: NameDef
      ): StateFnGeneratorBuilder<
        MachineStateName,
        StateAction | Actions.FromNameDef<"exit", NameDef>,
        StateTransitionDef,
        Substate,
        Context
      >;

      on<Def extends Transitions.Def<MachineStateName>>(
        transitions: Def[] | Def
      ): StateFnGeneratorBuilder<
        MachineStateName,
        StateAction,
        StateTransitionDef | Def,
        Substate,
        Context
      >;

      if<
        EventName extends string,
        Def extends Transitions.CaseDef<MachineStateName>
      >(
        name: EventName,
        cases: Def[] | Def
      ): StateFnGeneratorBuilder<
        MachineStateName,
        StateAction,
        | StateTransitionDef
        | Transitions.CaseDefToDef<MachineStateName, EventName, Def>,
        Substate,
        Context
      >;

      sub<
        SubstateName extends string,
        SubstateFactory extends Factories.AnyFactory,
        TrasitionDef extends SubstateFactory extends Factories.MachineFactory<
          infer State
        >
          ? State extends { name: infer FinalName extends string; final: true }
            ? QQ.SubstateFinalTransitionDef<MachineStateName, FinalName, any>
            : never
          : never = never
      >(
        name: SubstateName,
        factory: SubstateFactory,
        defs?: TrasitionDef | TrasitionDef[]
      ): StateFnGeneratorBuilder<
        MachineStateName,
        StateAction,
        StateTransitionDef,
        | Substate
        | QQ.Substate<
            SubstateName,
            SubstateFactory,
            QQ.SubstateFinalTransitionFromDef<TrasitionDef>
          >,
        Context
      >;
    }

    export interface StateFnGenerator<
      MachineStateName extends string,
      StateAction extends Actions.Action,
      StateTransitionDef extends Transitions.Def<MachineStateName> = never,
      Substate extends Substates.AnySubstate = never,
      Context = never
    > {
      ($: StateFnGeneratorBuilder<MachineStateName>): StateFnGeneratorBuilder<
        MachineStateName,
        StateAction,
        StateTransitionDef,
        Substate,
        Context
      >;
    }

    export type BuilderChainResult<
      MachineStateName extends string,
      ChainStateName extends MachineStateName,
      MachineState extends States.AnyState,
      StateName extends ChainStateName,
      StateAction extends Actions.Action,
      StateDef_ extends States.Def<MachineStateName>,
      Substate extends Substates.AnySubstate,
      Initial extends boolean,
      Final extends boolean,
      Context extends Contexts.Constraint | null
    > = Exclude<ChainStateName, StateName> extends never
      ? Factories.MachineFactory<
          States.BuilderStateToInstance<
            | MachineState
            | QQ.BuilderChainState<
                MachineStateName,
                StateName,
                StateAction,
                StateDef_,
                Substate,
                Initial,
                Final,
                Context
              >
          >
        >
      : Tail<
          MachineStateName,
          Exclude<ChainStateName, StateName>,
          | MachineState
          | QQ.BuilderChainState<
              MachineStateName,
              StateName,
              StateAction,
              StateDef_,
              Substate,
              Initial,
              Final,
              Context
            >
        >;

    export interface StateFn<
      Initial extends boolean,
      Final extends boolean,
      MachineStateName extends string,
      ChainStateName extends MachineStateName = MachineStateName,
      MachineState extends States.AnyState = never
    > {
      <StateName extends ChainStateName>(name: StateName): BuilderChainResult<
        MachineStateName,
        ChainStateName,
        MachineState,
        StateName,
        never,
        never,
        never,
        Initial,
        Final,
        null
      >;

      <
        StateName extends ChainStateName,
        StateAction extends Actions.Action,
        StateTransitionDef extends Transitions.Def<MachineStateName>,
        Substate extends Substates.AnySubstate,
        Context extends Contexts.Constraint | null = null
      >(
        name: StateName,
        generator: StateFnGenerator<
          MachineStateName,
          StateAction,
          StateTransitionDef,
          Substate,
          Context
        >
      ): BuilderChainResult<
        MachineStateName,
        ChainStateName,
        MachineState,
        StateName,
        StateAction,
        StateTransitionDef,
        Substate,
        Initial,
        Final,
        Context
      >;

      <
        StateName extends ChainStateName,
        StateDef_ extends States.Def<MachineStateName>
      >(
        name: StateName,
        transitions: StateDef_ | StateDef_[]
      ): BuilderChainResult<
        MachineStateName,
        ChainStateName,
        MachineState,
        StateName,
        never,
        StateDef_,
        never,
        Initial,
        Final,
        null
      >;

      <
        StateName extends ChainStateName,
        StateAction extends Actions.Action,
        StateDef extends States.Def<MachineStateName>,
        StateTransitionDef extends Transitions.Def<MachineStateName>,
        Substate extends Substates.AnySubstate,
        Context extends Contexts.Constraint | null = null
      >(
        name: StateName,
        transitions: StateDef | StateDef[],
        generator: StateFnGenerator<
          MachineStateName,
          StateAction,
          StateTransitionDef,
          Substate,
          Context
        >
      ): BuilderChainResult<
        MachineStateName,
        ChainStateName,
        MachineState,
        StateName,
        StateAction,
        StateDef | StateTransitionDef,
        Substate,
        Initial,
        Final,
        Context
      >;
    }
  }

  /**
   * The factories namespace. It contains all the types related to factories,
   * the entity that creates statechart instances.
   */
  export namespace Factories {
    /**
     * The factory type placeholder. It's used where the shape of
     * a factory isn't important or known.
     */
    export type AnyFactory = MachineFactory<any>;

    export interface MachineFactory<State extends States.AnyState> {
      /** The statechart name. Used for visualization and debugging. */
      name: string;

      /** The available states. */
      states: State[];

      host(
        ...args: Superstate.Actions.BindingArgs<State>
      ): QQ.MachineInstance<
        State,
        QQ.DeepFlatState<State>,
        QQ.DeepFlatEvent<State, State>,
        never
      >;
    }
  }

  /**
   * The substates namespace. It contains all the types related to substates,
   * the entity that represents a nested statechart relation to the parent.
   */
  export namespace Substates {
    export type AnySubstate = QQ.Substate<any, any, any>;

    export type BuilderSubstatesMap<Substate extends AnySubstate> = Record<
      Substate["name"],
      Substate
    >;

    export type InstanceSubstatesMap<Substate extends AnySubstate> = {
      [Name in Substate["name"]]: Substate extends {
        name: Name;
        factory: infer Factory;
      }
        ? Factory extends Factories.MachineFactory<infer SubstateState>
          ? QQ.MachineInstance<
              SubstateState,
              QQ.DeepFlatState<SubstateState>,
              QQ.DeepFlatEvent<SubstateState, SubstateState>,
              Substate
            >
          : never
        : never;
    };
  }

  /**
   * The contexts namespace. It contains all the types related to contexts,
   * the entity that represents the freeform data passing from state to state.
   */
  export namespace Contexts {
    /**
     * Context constraint.
     */
    export type Constraint = Record<string, any>;

    /**
     * Resolves true if the state has initial context.
     */
    export type HasInitialContext<State> = InitialContext<State> extends never
      ? false
      : true;

    /**
     * Resolves the initial state context.
     */
    export type InitialContext<State> = State extends {
      initial: true;
      [ContextBrand]: infer Context;
    }
      ? Context extends never
        ? never
        : keyof Context extends never
        ? never
        : Context
      : never;

    /**
     * The context brand symbol used to brand state with the context type.
     */
    export declare const ContextBrand: unique symbol;

    /**
     * Minimal context payload required to move from one state to another.
     */
    export type EventContext<
      AllState extends States.AnyState,
      FromName,
      NextState
    > = NextState extends {
      [Contexts.ContextBrand]: infer Context;
    }
      ? AllState extends {
          name: FromName;
          [Contexts.ContextBrand]: infer FromContext;
        }
        ? MinimalContext<Context, FromContext> extends infer EventContext
          ? keyof EventContext extends never
            ? null
            : EventContext
          : never
        : null // TODO: Figure out why changing this to never breaks the types
      : never;

    /**
     * Minimal context required when transitioning from one state to another.
     */
    type MinimalContext<Context, FromContext> = Context extends never
      ? never
      : Pick<Context, RequiredKeys<Context, FromContext>> &
          Partial<Omit<Context, RequiredKeys<Context, FromContext>>>;

    /**
     * Context keys required when transitioning from one state to another.
     */
    type RequiredKeys<Context, FromContext> = {
      [Key in keyof Context]: Key extends keyof FromContext
        ? Context[Key] extends FromContext[Key]
          ? never
          : Key
        : Key;
    }[keyof Context];
  }

  /**
   * Utils namespace. Contains everything that is not directly related to
   * the core types.
   */
  export namespace Utils {
    /**
     * Omits never fields.
     */
    export type OmitNever<Type> = Pick<
      Type,
      { [Key in keyof Type]: Type[Key] extends never ? never : Key }[keyof Type]
    >;

    /**
     * Makes given keys partial.
     */
    export type PartialKeys<Type, Keys> = Keys extends keyof Type
      ? Omit<Type, Keys> & Partial<Pick<Type, Keys>>
      : never;

    /**
     * Turns never to null.
     */
    export type NullIfNever<Type> = Type extends never ? null : Type;
  }
}
