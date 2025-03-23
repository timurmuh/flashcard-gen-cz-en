import {sleep} from "bun";
import {Yallist} from "yallist";

export type RateLimitConfig = {
  /** OpenRouter API key */
  apiKey: string;
  /** Maximum number of retries for a failed request */
  maxRetries?: number;
  /** Minimum delay for exponential backoff in ms */
  minBackoffDelay?: number;
  /** Maximum delay for exponential backoff in ms */
  maxBackoffDelay?: number;
  /** How many requests before checking credits again (0 to disable automatic checks) */
  updateRateLimitsRequestInterval?: number;
  /** Custom rate limit updater function */
  getUpdatedRateLimit?: () => Promise<number>;
  /** Initial requests per second (default: 1) */
  initialRequestsPerSecond?: number;
  /** Optional callback for successful task completion */
  onTaskSuccess?: <T>(result: T) => void;
  /** Optional callback for task errors */
  onTaskError?: (error: Error, reason: TaskRejectReason) => void;
};

/**
 * A function to enqueue and execute with rate limiting.
 *
 * The type assumes that the task can be unsuccessful, and that failure can happen due to rate limiting
 * (e.g. http requests), in which case it will be retried with exponential backoff, or it can happen for other reasons,
 * in which case the task will be immediately rejected, and the user would have to handle retrying themselves.
 */
export type TaskFn<T> = (
  resolve: (value: T) => void,
  reject: (reason: TaskRejectReason, error: any) => void
) => Promise<void> | void;

export enum TaskRejectReason {
  RATE_LIMIT = 'rate-limit',
  OTHER = 'other',
}

type RequestTask<T> = {
  execute: TaskFn<T>;
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason?: any) => void;
  retries: number;
};

type ProcessingResult<T> = {
  success: boolean;
  value?: T;
  error?: {
    reason: TaskRejectReason;
    error: Error | unknown;
  };
};

// TODO unit tests
export class RateLimitedTaskQueue<T> {
  private queue: Yallist<RequestTask<T>> = Yallist.create();
  private processing = false;
  private requestsPerSecond: number;
  private requestsUntilNextCheck: number;
  // TODO why omit, why not to use the type directly?
  private readonly config: Required<Omit<RateLimitConfig, 'getUpdatedRateLimit' | 'onTaskSuccess' | 'onTaskError'>> & {
    getUpdatedRateLimit?: () => Promise<number>;
    onTaskSuccess?: <U>(result: U) => void;
    onTaskError?: (error: Error, reason: TaskRejectReason) => void;
  };
  private lastRequestTimestamp = 0;

  constructor(config: RateLimitConfig) {
    // Default configuration with sensible values
    this.config = {
      updateRateLimitsRequestInterval: 10, // Check credits every 10 requests, 0 to disable
      maxRetries: 5,
      minBackoffDelay: 1000, // 1 second
      maxBackoffDelay: 60000, // 1 minute
      initialRequestsPerSecond: 1,
      ...config,
    };

    this.requestsPerSecond = this.config.initialRequestsPerSecond;
    this.requestsUntilNextCheck = this.config.updateRateLimitsRequestInterval;
  }

  /**
   * Enqueues a task to be executed with rate limiting
   */
  public async enqueue(taskFn: TaskFn<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push({
        execute: taskFn,
        resolve,
        reject,
        retries: 0,
      });

      // Start processing the queue if it's not already running
      if (!this.processing) {
        this.processQueue();
      }
    });
  }

  /**
   * Manually update the rate limit
   */
  public async updateRateLimit(): Promise<void> {
    try {
      if (this.config.getUpdatedRateLimit) {
        // Use the provided rate limit updater
        this.requestsPerSecond = await this.config.getUpdatedRateLimit();
      } else {
        // If no custom updater is provided, assume a static rate limit
        // using the initialRequestsPerSecond value
        this.requestsPerSecond = this.config.initialRequestsPerSecond;
      }

      console.log(`Updated rate limit: ${this.requestsPerSecond} requests per second`);
    } catch (error) {
      console.error("Error updating rate limit:", error);
      // In case of error, we keep the existing rate limit
    }
  }

  /**
   * Handles the specified delay between requests to maintain rate limit
   */
  private async enforceRateLimit(): Promise<void> {
    const currentTime = Date.now();
    const timeSinceLastRequest = currentTime - this.lastRequestTimestamp;
    const minTimeBetweenRequests = 1000 / Math.max(1, this.requestsPerSecond); // ms between requests

    if (timeSinceLastRequest < minTimeBetweenRequests) {
      const waitTime = minTimeBetweenRequests - timeSinceLastRequest;
      await sleep(waitTime);
    }
    this.lastRequestTimestamp = Date.now();
  }

  /**
   * Executes a task and handles potential errors
   */
  private async executeTask(task: RequestTask<T>): Promise<ProcessingResult<T>> {
    if (this.config.updateRateLimitsRequestInterval > 0) {
      this.requestsUntilNextCheck--;
    }

    return new Promise<ProcessingResult<T>>(resolve => {
      const taskResolve = (value: T) => {
        if (this.config.onTaskSuccess) {
          this.config.onTaskSuccess(value);
        }
        resolve({success: true, value});
      };

      const taskReject = (reason: TaskRejectReason, error: any) => {
        if (this.config.onTaskError) {
          const errorObj = error instanceof Error ? error : new Error(String(error));
          this.config.onTaskError(errorObj, reason);
        }
        resolve({
          success: false,
          error: {reason, error}
        });
      };

      // wrap the provided task to automatically reject task in case of any uncaught errors
      try {
        task.execute(taskResolve, taskReject);
      } catch (error) {
        taskReject(TaskRejectReason.OTHER, error);
      }
    });
  }

  /**
   * Handles errors during task execution
   */
  private async handleTaskError(
    task: RequestTask<T>,
    errorInfo: { reason: TaskRejectReason, error: any }
  ): Promise<void> {
    if (errorInfo.reason === TaskRejectReason.RATE_LIMIT && task.retries < this.config.maxRetries) {
      // Calculate exponential backoff
      const backoffTime = Math.min(
        this.config.maxBackoffDelay,
        this.config.minBackoffDelay * Math.pow(2, task.retries)
      );

      console.warn(`Rate limit hit. Retrying in ${backoffTime}ms (retry ${task.retries + 1}/${this.config.maxRetries})`);

      // Increment retry count
      task.retries++;

      this.queue.unshift(task);

      // Wait before processing again
      await sleep(backoffTime);
    } else if (errorInfo.reason === TaskRejectReason.RATE_LIMIT) {
      // Max retries reached for rate limit error
      const error = new Error(`Failed after ${this.config.maxRetries} retries: ${errorInfo.error.message || String(errorInfo.error)}`);
      task.reject(error);
    } else {
      // Non-rate limiting error
      task.reject(errorInfo.error);
    }
  }

  private async processQueue(): Promise<void> {
    if (this.processing || this.queue.length === 0) {
      return;
    }

    this.processing = true;

    try {
      // Check if we need to update our rate limit at the start
      if (
        this.config.getUpdatedRateLimit &&
        this.config.updateRateLimitsRequestInterval > 0 &&
        this.requestsUntilNextCheck <= 0
      ) {
        await this.updateRateLimit();
        this.requestsUntilNextCheck = this.config.updateRateLimitsRequestInterval;
      }

      const task = this.queue.shift();
      if (!task) {
        this.processing = false;
        return;
      }

      // Enforce rate limiting
      await this.enforceRateLimit();

      // Execute the task
      const result = await this.executeTask(task);

      if (result.success && result.value !== undefined) {
        task.resolve(result.value);
      } else if (result.error) {
        await this.handleTaskError(task, result.error);
      }
    } catch (err) {
      console.error("Error in queue processing:", err);
    } finally {
      this.processing = false;
      // Continue processing the queue
      if (this.queue.length > 0) {
        // Use setTimeout instead of recursion to avoid stack overflow
        setTimeout(() => this.processQueue(), 0);
      }
    }
  }

  /**
   * Returns the current size of the queue
   */
  public get size(): number {
    return this.queue.length;
  }

  /**
   * Clears all pending tasks in the queue
   */
  public clear(): void {
    // Create a new empty list instead of trying to clear the existing one
    this.queue = Yallist.create();
  }
}