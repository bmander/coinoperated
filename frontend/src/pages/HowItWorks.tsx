import { Link } from "react-router-dom";

export default function HowItWorks() {
  return (
    <div className="how-it-works-page">
      <Link to="/" className="back-link">&larr; Back to tasks</Link>
      <h1>How This Works</h1>

      <p>
        <strong>Coin Operated Brandon</strong> is a way for a community to pool their money behind
        the small, world-spanning annoyances that somehow never get fixed.
        Every open source project has them: broken config options, outdated docs,
        ten year old bugs; the countless squeaky floorboards of digital life we all
        encounter every day. Anyone can submit a task, everyone who cares
        about it can pledge a few dollars toward getting it done, and pledges are
        collected only after the work is completed. You never pay for something
        that doesn't happen.
      </p>

      <p>
        Behind the scenes, it's all me, <a href="https://bmander.com">Brandon
        Martin-Anderson</a>. I review incoming tasks, accept the ones I can tackle,
        and posts updates as I go. When a task is marked complete, pledges are
        charged and the funds go to me directly. If I decline a task or it
        sits too long, your pledge is released and you're never charged. The
        whole cycle is transparent&mdash;you can see every task's status, how
        much has been pledged, and what's been collected.
      </p>

      <p>
        Basically, this is a one-person Patreon combined with a bounty board.
        It's a way of collecting information about what people need, combined
        with a way of drumming up work for myself that gives me the freedom I
        feel we all deserve.
      </p>

      <p>
        To get started, browse the <Link to="/">task board</Link> and pledge
        toward anything that matters to you, or{" "}
        <Link to="/tasks/new">submit a new task</Link> if you don't see what
        you're looking for. You'll need to sign in with your email so we can
        notify you when a task you've backed is accepted, completed, or
        declined. That's it - no accounts to manage, no subscriptions, just
        small bets on getting things done.
      </p>
    </div>
  );
}
