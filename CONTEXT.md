# GTA Cost of Living Calculator - Requirements (User's Own Words)

Everything below is taken directly from the user's prompts, organized by topic.

---

## Core Concept

> Build me a mathematical modeling platform to figure out how much money I need to make for living in the GTA. It should have beautiful LaTeX-style equations. The end goal number should be at the top of the screen.

> I should be able to tap the literal numbers in the equations, with up and down arrows, to make them go up or down. When you update a number, the whole system recalculates live. Everything should be on one screen, all editable right there in front of me, not hidden behind tapping a node to open it. Designed for mobile.

> When the equation says gross income it should probably say required gross income.

---

## Visual Flow / Connections Between Equations

> There should be visuals showing how all the equations are connected, like a flow diagram. Circle the letters in the equations, and draw arrows between them. Like if "t" appears in one equation, a line draws from that circled "t" to the other equation where "t" is defined. Both t's should be circled. The arrow points towards where the variable comes from.

> For the letters those are kinda dumb maybe it should say like Housing then u circle that instead of just circling the H it makes it kinda arbitrary.

> Also when u have stuff like CPP and EI but there is no place they are pointing too that is bad.. each term inside of an equation should have a place it points too.

> Also I hate how there are 2 equations going into the E... is that necessary? There should not be 2 arrows pointing to one letter thats dumb i think.

> All the equations should be shown and the specific terms in the equation should be circled then pointing to the next term that it comes from.

---

## Arrow / Line Behavior

> No the lines before were way better its ok if they cross just spread them out on the page more.

> No spread em horizontally across screen like its a white board and now ur putting lines starting from center of letter makes no sense should be connected to outside of circle.

> The white boxes cut off the arrows.... I need the arrows to be over the white boxes connections to the circle around the letter.

> Baw I want the arrow heads still just maybe make them same opacity as lines or vice versa.

> The line is also still darker than the arrowhead...

> Can u please make the lines normal to the bubbles just at the end? Like sometimes they are weirdly shaped or oriented at both the start and end of them.

> The bottom right equation does not have the perpendicular lines... I mean just perpendicular at the very end you made them way too perpendicular all the way up the line too for the other ones.

> Is there any way you can make the lines not cross over the other stuff? Like route them to free space?

> The lines are covering everything. I want lines connected still so dont remove them. Also the arrowheads are on the center of the word they should be connected to the bubble.

> Also all the explanatory equations dont have to be in a line. I hate when the lines cross over the other things. Spread them out in a way that makes them close to the above equation without causing lines to run over other boxes or lines.

---

## Equations / Detail Level

> I don't know what each of the letters mean like equations should be written 2 times once with words stating what the variables are and the next with the adjustable values.

> Also can you make it more complex the equations and add more things to consider? Maybe like differential modeling too or something that makes these more accurate.

> Also when u did all the bottom differential equations I dont want them there i want everything baked into some formula at the top with the arrows pointing to everything. Need to show connections.

> Why are u including inflation in this? Like this is required gross income? This is like a now thing why would inflation be on there? U shouldn't just throw equations at the bottom of the page that dont mean anything or have no line connection to the other ones.

---

## Budget Detail

> Also dont just say something like pet care. Need u to do like exactly how much each thing is. I.e. pet food, vet visits, grooming, etc. I need you to make sure these arent categories only but an accurate detailed breakdown of every single thing inside.

> Where is haircuts in there? You need to do research to figure out the detailed accurate list.

> Electric car 1 tesla financed about 1200 per month without insurance repairs etc.

---

## Theme / Design

> Color scheme ugly I want lighter modern theme.

> Subs is not a good word doesnt make sense. (Changed to "Bills")

---

## Summary of Key Rules

1. Required gross income number at the top, recalculates live
2. All equations visible on one screen, not behind taps
3. Every term in an equation is circled (pill/bubble) and points to where it's defined
4. Arrows connect to the OUTSIDE of the bubble, not the center of the word
5. Arrowheads same opacity as lines
6. Lines perpendicular to the bubble only at the very tip, natural curves for the rest
7. Route lines so they don't cross over boxes/content - use free space (margins/gutters)
8. No disconnected equations - everything must connect to the system
9. No inflation/wealth projection - this is a current "required gross income" tool
10. Full itemized breakdown for each category (not just category names)
11. Word labels on pills (e.g. "Housing") not single letters (e.g. "H")
12. Light modern theme
13. Designed for mobile
14. Each term in an equation must have a place it points to (no dangling references)
15. No duplicate arrows pointing to the same term
