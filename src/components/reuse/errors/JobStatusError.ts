import {ISampleDocumentJob} from "../../../../@types/bdp";

export class JobStatusError extends Error {
    readonly job: any;
    readonly expectedJobStatuses: string[];

    constructor(job: ISampleDocumentJob, expectedJobStatuses: string[]) {
        super(`unexpected job status; expected ${expectedJobStatuses}; actual: ${job.status}`);
        this.job = job;
        this.expectedJobStatuses = expectedJobStatuses;
    }
}