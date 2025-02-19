// ets_tracing: off

import * as CK from "../../../../Collections/Immutable/Chunk"
import * as Tp from "../../../../Collections/Immutable/Tuple"
import * as T from "../../../../Effect"
import * as E from "../../../../Either"
import * as F from "../../../../Fiber"
import { pipe } from "../../../../Function"
import * as M from "../../../../Managed"
import type * as O from "../../../../Option"
import * as Ref from "../../../../Ref"
import type * as C from "../core"
import * as Chain from "./chain"
import * as Concat from "./concat"
import * as FromChunk from "./fromChunk"
import * as FromEffect from "./fromEffect"
import * as FromEffectOption from "./fromEffectOption"
import * as FromPull from "./fromPull"
import * as MapEffect from "./mapEffect"
import * as MergeEither from "./mergeEither"
import * as RepeatEffectOption from "./repeatEffectOption"
import * as ToPull from "./toPull"

/**
 * Zips the two streams so that when a value is emitted by either of the two streams,
 * it is combined with the latest value from the other stream to produce a result.
 *
 * Note: tracking the latest value is done on a per-chunk basis. That means that
 * emitted elements that are not the last value in chunks will never be used for zipping.
 */
export function zipWithLatest_<R, R1, E, E1, A, A1, A2>(
  self: C.Stream<R, E, A>,
  that: C.Stream<R1, E1, A1>,
  f: (a: A, a1: A1) => A2
): C.Stream<R & R1, E | E1, A2> {
  const pullNonEmpty = <R, E, O>(
    pull: T.Effect<R, O.Option<E>, CK.Chunk<O>>
  ): T.Effect<R, O.Option<E>, CK.Chunk<O>> =>
    T.chain_(pull, (chunk) =>
      CK.isEmpty(chunk) ? pullNonEmpty(pull) : T.succeed(chunk)
    )

  return FromPull.fromPull(
    pipe(
      M.do,
      M.bind("left", () => M.map_(ToPull.toPull(self), pullNonEmpty)),
      M.bind("right", () => M.map_(ToPull.toPull(that), pullNonEmpty)),
      M.bind("pull", ({ left, right }) =>
        ToPull.toPull(
          Chain.chain_(
            FromEffectOption.fromEffectOption(
              T.raceWith_(
                left,
                right,
                (leftDone, rightFiber) =>
                  T.zipWith_(T.done(leftDone), F.join(rightFiber), (l, r) =>
                    Tp.tuple(l, r, true)
                  ),
                (rightDone, leftFiber) =>
                  T.zipWith_(T.done(rightDone), F.join(leftFiber), (r, l) =>
                    Tp.tuple(l, r, false)
                  )
              ) as T.Effect<
                R & R1,
                O.Some<E | E1>,
                Tp.Tuple<[CK.Chunk<A>, CK.Chunk<A1>, boolean]>
              >
            ),
            ({ tuple: [l, r, leftFirst] }) =>
              Chain.chain_(
                FromEffect.fromEffect(
                  Ref.makeRef(
                    Tp.tuple(
                      CK.unsafeGet_(l, CK.size(l) - 1),
                      CK.unsafeGet_(r, CK.size(r) - 1)
                    )
                  )
                ),
                (latest) =>
                  Concat.concat_(
                    FromChunk.fromChunk(
                      leftFirst
                        ? CK.map_(r, (_) => f(CK.unsafeGet_(l, CK.size(l) - 1), _))
                        : CK.map_(l, (_) => f(_, CK.unsafeGet_(r, CK.size(r) - 1)))
                    ),
                    pipe(
                      RepeatEffectOption.repeatEffectOption(left),
                      MergeEither.mergeEither(
                        RepeatEffectOption.repeatEffectOption(right)
                      ),
                      MapEffect.mapEffect(
                        E.fold(
                          (leftChunk) =>
                            Ref.modify_(latest, ({ tuple: [_, rightLatest] }) =>
                              Tp.tuple(
                                CK.map_(leftChunk, (_) => f(_, rightLatest)),
                                Tp.tuple(
                                  CK.unsafeGet_(leftChunk, CK.size(leftChunk) - 1),
                                  rightLatest
                                )
                              )
                            ),
                          (rightChunk) =>
                            Ref.modify_(latest, ({ tuple: [leftLatest, _] }) =>
                              Tp.tuple(
                                CK.map_(rightChunk, (_) => f(leftLatest, _)),
                                Tp.tuple(
                                  leftLatest,
                                  CK.unsafeGet_(rightChunk, CK.size(rightChunk) - 1)
                                )
                              )
                            )
                        )
                      ),
                      Chain.chain(FromChunk.fromChunk)
                    )
                  )
              )
          )
        )
      ),
      M.map(({ pull }) => pull)
    )
  )
}

/**
 * Zips the two streams so that when a value is emitted by either of the two streams,
 * it is combined with the latest value from the other stream to produce a result.
 *
 * Note: tracking the latest value is done on a per-chunk basis. That means that
 * emitted elements that are not the last value in chunks will never be used for zipping.
 *
 * @ets_data_first zipWithLatest_
 */
export function zipWithLatest<R1, E1, A, A1, A2>(
  that: C.Stream<R1, E1, A1>,
  f: (a: A, a1: A1) => A2
) {
  return <R, E>(self: C.Stream<R, E, A>) => zipWithLatest_(self, that, f)
}
