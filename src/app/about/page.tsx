
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Target, CheckCircle } from "lucide-react";

export default function AboutUsPage() {
  return (
    <main className="bg-muted/40 min-h-screen p-4 md:p-8">
      <div className="container mx-auto max-w-4xl space-y-8">
        <header className="text-center">
          <h1 className="text-5xl font-headline font-black text-primary-dark-blue">
            About Playcer
          </h1>
          <p className="mt-2 text-lg text-muted-foreground max-w-2xl mx-auto">
            Playcer was born from a simple observation: the most exciting bets
            aren't against a faceless house, but against a friend, a rival, or
            that one person in the group chat who's always a little too
            confident. We make those challenges real.
          </p>
        </header>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="text-primary" />
              Our Mission
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-muted-foreground">
            <p>
              Our mission is to bring the social and competitive spirit back to
              sports betting. We believe that betting should be personal. It
              should be about the friendly rivalries, the bragging rights, and
              the shared experience of the game.
            </p>
            <p>
              By removing the house from the equation, we empower fans to engage
              with sports and each other in a more authentic way. We are not a
              traditional sportsbook; we are a marketplace for passion.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="text-primary" />
              The Playcer Difference
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-4 text-muted-foreground">
              <li className="flex items-start gap-3">
                <Users className="mt-1 h-5 w-5 flex-shrink-0 text-primary" />
                <div>
                  <h3 className="font-bold text-foreground">Peer-to-Peer</h3>
                  <p>
                    You bet directly against other users, not a corporation. Set
                    your own terms and find a challenger.
                  </p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle className="mt-1 h-5 w-5 flex-shrink-0 text-primary" />
                <div>
                  <h3 className="font-bold text-foreground">You Set the Terms</h3>
                  <p>
                    From the pick to the stake, you propose the bets you want to
                    see. No more accepting unfavorable lines from the house.
                  </p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <Users className="mt-1 h-5 w-5 flex-shrink-0 text-primary" />
                <div>
                  <h3 className="font-bold text-foreground">Community-Focused</h3>
                  <p>
                    We're building a platform where sports fans can connect,
                    compete, and share their passion for the game.
                  </p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <Target className="mt-1 h-5 w-5 flex-shrink-0 text-primary" />
                <div>
                  <h3 className="font-bold text-foreground">Fair and Transparent</h3>
                  <p>
                    With a small commission only on winnings, our model is
                    straightforward and built to serve the users, not the
                    bookie.
                  </p>
                </div>
              </li>
            </ul>
          </CardContent>
        </Card>

        <div className="text-center">
          <p className="text-lg font-semibold">
            Thank you for being a part of our community. Now, go find a challenger.
          </p>
        </div>
      </div>
    </main>
  );
}

    