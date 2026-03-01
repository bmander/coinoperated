import { Link } from "react-router-dom";

export default function HowItWorks() {
  return (
    <div className="how-it-works-page">
      <Link to="/" className="back-link">&larr; Back to tasks</Link>
      <h1>How This Works</h1>

      <p>
        <strong>Coin Operated Brandon</strong> is a way for folks to pitch in to solve
        small, world-spanning annoyances that somehow never get fixed.
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
        sits too long, your pledge is released and you're never charged.
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
        declined.
      </p>

      <h2>Some Potentially Frequently Asked Questions</h2>

      <h3>So it's consulting?</h3>
      <p>No, because the pledgers can neither direct the work nor capture a predictable amount of value from the result.</p>

      <h3>So it's a donation?</h3>
      <p>No, because you pledge roughly the amount of value you expect to receive from the work being done.
        </p>

      <h3>Then what's the point?</h3> 
      <p>
        You pay $5 for a job that delivers $5 of value to you, just like a normal transaction. The difference in this
        case is that it's only true <em>on average</em>, but in a prosocial way. You trust others; they trust you.
        You can model the return on investment more like voting in a democracy where you will be taxed and receive public goods in return.
      </p>

      <h3>Can I just hire you?</h3>
      <p>You can try. Email me at <a href="mailto:brandon.m.anderson@gmail.com">brandon.m.anderson@gmail.com</a>.
      I won't work on things that I think will hurt or disempower people and I like to keep control of my work, so
      I'm not a great fit for most organizations. Also I keep weird hours.
      </p>

      <h3>How small of a job? Will you fix my bicycle?</h3>
      <p>You can certainly ask.</p>

      <h3>How large of a job? Will you make a new operating system?</h3>
      <p>Maybe. Try to convince me.</p>

      <h3>What kind of stuff are you into?</h3>
      <p>
        Maps, public transit, bicycles, data visualization, maker spaces, empowering workers, art, computing,
        community resources, urbanism, ecology, democracy, etc.
      </p>

      <h3>What won't you do?</h3>
      <p>
        Crypto, gambling, speculative finance, market intermediation, weapons, surveillance, advertising, car culture, 
        weight loss, wellness, exclusive luxury, etc.
      </p>

      <h3>Do you use AI?</h3>
      <p>
        When it's useful. Sometimes whole teams of AIs. Whatever tools I use, I take personal accountability for everything I put my name to.
      </p>
    </div>
  );
}
