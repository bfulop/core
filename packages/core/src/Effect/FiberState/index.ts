import type * as Tp from "../../Collections/Immutable/Tuple"
import type { Has, Tag, TypeTag } from "../../Has"
import { tag } from "../../Has"
import * as T from ".."
import * as FRef from "../FiberRef"
import * as L from "../Layer"

export interface FiberState<S> {
  //readonly serviceId: `@effect-ts/core/Effect/FiberState<${TypeTag<S>}>`

  readonly get: T.Effect<unknown, never, S>

  readonly set: (s: S) => T.Effect<unknown, never, void>

  readonly update: (f: (s: S) => S) => T.Effect<unknown, never, void>

  readonly modify: <A>(f: (s: S) => Tp.Tuple<[A, S]>) => T.Effect<unknown, never, A>
}

export interface FiberStateExternal<S> {
  readonly Tag: Tag<FiberState<S>>

  readonly get: T.Effect<Has<FiberState<S>>, never, S>

  readonly set: (s: S) => T.Effect<Has<FiberState<S>>, never, void>

  readonly update: (f: (s: S) => S) => T.Effect<Has<FiberState<S>>, never, void>

  readonly modify: <A>(
    f: (s: S) => Tp.Tuple<[A, S]>
  ) => T.Effect<Has<FiberState<S>>, never, A>

  readonly runState: (
    s: S
  ) => <R, E, A>(self: T.Effect<Has<FiberState<S>> & R, E, A>) => T.Effect<R, E, A>

  readonly Live: (s: S) => L.Layer<unknown, never, Has<FiberState<S>>>
}

export function makeFiberState<S>(initial: S): T.Effect<unknown, never, FiberState<S>> {
  return T.map_(FRef.make(initial), (ref) => ({
    get: FRef.get(ref),
    modify: (f) => FRef.modify_(ref, f),
    set: (s) => FRef.set_(ref, s),
    update: (f) => FRef.update_(ref, f)
  }))
}

export function FiberState<S>(S: TypeTag<S>): FiberStateExternal<S> {
  const Tag = tag<FiberState<S>>().setKey(`@effect-ts/core/Effect/FiberState<${S}>`)
  const derived = T.deriveLifted(Tag)(["set", "update"], ["get"], [])

  return {
    Tag,
    modify: (f) => T.accessServiceM(Tag)((_) => _.modify(f)),
    runState: (s) => T.provideServiceM(Tag)(makeFiberState(s)),
    Live: (s) => L.fromEffect(Tag)(makeFiberState(s)),
    ...derived
  }
}
