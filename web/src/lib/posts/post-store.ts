export type PostType = "lost" | "found";
export type PostStatus = "active" | "claiming" | "returned" | "hidden" | "deleted";

export interface PostRecord {
  id: string;
  authorEmail: string;
  type: PostType;
  title: string;
  category: string;
  location: string;
  eventAt: string;
  description: string | null;
  photoPaths: string[];
  status: PostStatus;
  storagePlace: string | null;
  secretQuestion: string | null;
  secretAnswerHash: string | null;
  createdAt: string;
  statusChangedAt: string;
}

interface CreatePostInput {
  authorEmail: string;
  type: PostType;
  title: string;
  category: string;
  location: string;
  eventAt: string;
  description?: string;
  photoPaths?: string[];
  storagePlace?: string;
  secretQuestion?: string;
  secretAnswerHash?: string;
  now: () => number;
}

interface UpdatePostInput {
  title?: string;
  category?: string;
  location?: string;
  eventAt?: string;
  description?: string | null;
  photoPaths?: string[];
  status?: PostStatus;
  storagePlace?: string | null;
  secretQuestion?: string | null;
  secretAnswerHash?: string | null;
  now?: () => number;
}

class InMemoryPostStore {
  private readonly posts: PostRecord[] = [];

  list(): PostRecord[] {
    return [...this.posts];
  }

  create(input: CreatePostInput): PostRecord {
    const createdAt = new Date(input.now()).toISOString();

    const post: PostRecord = {
      id: crypto.randomUUID(),
      authorEmail: input.authorEmail,
      type: input.type,
      title: input.title,
      category: input.category,
      location: input.location,
      eventAt: input.eventAt,
      description: input.description ?? null,
      photoPaths: input.photoPaths ?? [],
      status: "active",
      storagePlace: input.storagePlace ?? null,
      secretQuestion: input.secretQuestion ?? null,
      secretAnswerHash: input.secretAnswerHash ?? null,
      createdAt,
      statusChangedAt: createdAt,
    };

    this.posts.push(post);
    return post;
  }

  findById(postId: string): PostRecord | null {
    return this.posts.find((post) => post.id === postId) ?? null;
  }

  update(postId: string, input: UpdatePostInput): PostRecord | null {
    const post = this.findById(postId);

    if (!post) {
      return null;
    }

    if (input.title !== undefined) {
      post.title = input.title;
    }

    if (input.category !== undefined) {
      post.category = input.category;
    }

    if (input.location !== undefined) {
      post.location = input.location;
    }

    if (input.eventAt !== undefined) {
      post.eventAt = input.eventAt;
    }

    if (input.description !== undefined) {
      post.description = input.description;
    }

    if (input.photoPaths !== undefined) {
      post.photoPaths = input.photoPaths;
    }

    if (input.status !== undefined) {
      if (post.status !== input.status) {
        const now = input.now ?? Date.now;
        post.statusChangedAt = new Date(now()).toISOString();

        if (input.status === "returned") {
          post.photoPaths = [];
        }
      }

      post.status = input.status;
    }

    if (input.storagePlace !== undefined) {
      post.storagePlace = input.storagePlace;
    }

    if (input.secretQuestion !== undefined) {
      post.secretQuestion = input.secretQuestion;
    }

    if (input.secretAnswerHash !== undefined) {
      post.secretAnswerHash = input.secretAnswerHash;
    }

    return post;
  }

  markDeleted(postId: string): PostRecord | null {
    return this.update(postId, {
      status: "deleted",
    });
  }

  clear(): void {
    this.posts.length = 0;
  }
}

const sharedPostStore = new InMemoryPostStore();

export function getSharedPostStore(): InMemoryPostStore {
  return sharedPostStore;
}

export function __clearPostStoreForTests(): void {
  sharedPostStore.clear();
}
