export class InvalidInputStringError extends Error {
    constructor(message) {
        super(message);
    }
}

export class InvalideDateStringError extends InvalidInputStringError {
    constructor(message) {
        super(message);
    }
};

export class InvalidNumberStringError extends InvalidInputStringError {
    constructor(message) {
        super(message);
    }
}

export class InvalidCurrencyStringError extends InvalidInputStringError {
    constructor(message) {
        super(message);
    }
}