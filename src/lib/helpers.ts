// Promise Helpers
// TODO: Move to a dedicated file.
const pending = {
  state: "pending",
};

type PromiseState = {
  state: string;
  reason: any;
};

export async function getPromiseState(
  promise: Promise<any>,
): Promise<PromiseState> {
  // We put `pending` promise after the promise to test,
  // which forces .race to test `promise` first
  return await Promise.race([promise, pending]).then(
    (value) => {
      if (value === pending) {
        return value;
      }
      return {
        state: "resolved",
        value,
      };
    },
    (reason) => ({ state: "rejected", reason }),
  );
}
