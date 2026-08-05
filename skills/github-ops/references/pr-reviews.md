# PR comments and reviews in depth

A PR has three comment surfaces backed by different endpoints. Mixing them up
is the most common failure mode:

| Surface | Endpoint | Notes |
|---|---|---|
| Conversation comments (main thread) | `repos/{owner}/{repo}/issues/N/comments` | PRs are issues to this endpoint |
| Reviews (approve / request changes / comment, with a body) | `repos/{owner}/{repo}/pulls/N/reviews` | states: APPROVED, CHANGES_REQUESTED, COMMENTED, PENDING |
| Inline review comments (anchored to diff lines) | `repos/{owner}/{repo}/pulls/N/comments` | fields: `path`, `line`, `body`, `id`, `in_reply_to_id`, `user.login` |

## Reading

```bash
gh pr view 123 --json title,body,state,reviewDecision,statusCheckRollup
gh pr view 123 --json comments --jq '.comments[] | {author: .author.login, body}'
gh pr view 123 --json reviews,latestReviews

# Inline comments are NOT in gh pr view --json — API only:
gh api repos/{owner}/{repo}/pulls/123/comments \
  --jq '.[] | {id, path, line, author: .user.login, in_reply_to_id, body}'
```

Reconstruct threads by grouping on `in_reply_to_id`: top-level comments have
none; replies point at the thread root. On busy PRs add `--paginate` (comment
endpoints return 30 per page by default).

**REST comment data has no resolution state** — it returns resolved and
outdated threads mixed in with live ones. When the goal is "what feedback
still needs addressing", use GraphQL `reviewThreads` and filter on
`isResolved` / `isOutdated`:

```bash
gh api graphql --paginate -F owner='{owner}' -F name='{repo}' -F number=123 -f query='
  query($owner: String!, $name: String!, $number: Int!, $endCursor: String) {
    repository(owner: $owner, name: $name) {
      pullRequest(number: $number) {
        reviewThreads(first: 50, after: $endCursor) {
          nodes {
            isResolved isOutdated path
            comments(first: 30) { nodes { author { login } body databaseId } }
          }
          pageInfo { hasNextPage endCursor }
        }
      }
    }
  }' --jq '.data.repository.pullRequest.reviewThreads.nodes[] | select(.isResolved | not)'
```

The `databaseId` on each comment is the id to use for REST replies below.

To fetch the comments attached to one review submission:

```bash
gh api repos/{owner}/{repo}/pulls/123/reviews/<review-id>/comments
```

## Posting conversation comments

```bash
gh pr comment 123 --body-file comment.md        # preferred for multiline
gh pr comment 123 -b "Short one-liner"
gh pr comment 123 --edit-last --create-if-none -F status.md   # idempotent "upsert my comment"
gh pr comment 123 --delete-last --yes
```

Never inline multiline text with `\n` escapes in `-b` — they render
literally. Use `--body-file`, `-F -` with a heredoc on stdin, or
`-b "$(cat <<'EOF' ... EOF)"`.

## Submitting reviews

```bash
gh pr review 123 --approve
gh pr review 123 --request-changes -b "Blocking: the migration is not reversible"
gh pr review 123 --comment --body-file review.md
```

## Replying to an inline review thread

```bash
gh api -X POST repos/{owner}/{repo}/pulls/123/comments/<comment-id>/replies \
  -f body='Fixed in abc1234.'
```

`<comment-id>` is the `id` of the thread's root comment (or any comment in
it; GitHub attaches the reply to the thread).

## Creating a new inline comment

Requires the head commit SHA, file path, and line. Integer fields mean `-f`
(strings only) will 422 — use `-F` for typed values:

```bash
sha=$(gh pr view 123 --json headRefOid --jq .headRefOid)
gh api -X POST repos/{owner}/{repo}/pulls/123/comments \
  -f body='This lookup is O(n^2); consider a map.' \
  -f commit_id="$sha" -f path='src/index.ts' \
  -F line=42 -f side=RIGHT
```

For a multi-line anchor add `-F start_line=38 -f start_side=RIGHT`.

## Creating a review with attached inline comments

One API call posts a review plus its comments atomically. The nested array
requires a JSON body via `--input -`. Pin `commit_id` to the head SHA you
actually reviewed (otherwise a push racing your review shifts the anchors)
and give every comment an explicit `side`:

```bash
sha=$(gh pr view 123 --json headRefOid --jq .headRefOid)
gh api -X POST repos/{owner}/{repo}/pulls/123/reviews --input - <<EOF
{
  "commit_id": "$sha",
  "event": "REQUEST_CHANGES",
  "body": "A few blocking issues, details inline.",
  "comments": [
    {"path": "src/index.ts", "line": 42, "side": "RIGHT", "body": "Off-by-one here."},
    {"path": "src/db.ts", "line": 10, "side": "RIGHT", "body": "Missing await."}
  ]
}
EOF
```

Use `side: "LEFT"` to anchor on deleted lines; ranges add `start_line` and
`start_side`.

Omit `event` (or use `PENDING` semantics) to leave the review as a draft;
submit later with `POST pulls/123/reviews/<review-id>/events`.
