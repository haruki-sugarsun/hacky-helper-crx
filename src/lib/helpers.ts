// Promise Helpers
// TODO: Move to a dedicated file.
const pending = {
    state: 'pending',
};

export function getPromiseState(promise: Promise<any>): Promise<any> {
    // We put `pending` promise after the promise to test, 
    // which forces .race to test `promise` first
    return Promise.race([promise, pending]).then(
        (value) => {
            if (value === pending) {
                return value;
            }
            return {
                state: 'resolved',
                value
            };
        },
        (reason) => ({ state: 'rejected', reason })
    );
}
