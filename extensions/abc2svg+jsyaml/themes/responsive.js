window.addEventListener('load', setup)
window.addEventListener('resize', setup)

function setup() {
  // Define breakpoints and their associated class names
  const breakpoints = [
    { name: 'narrow', ems: 24 },
    { name: 'wide', ems: 34 },
    { name: 'full', ems: Infinity },
  ]

  const names = breakpoints.map((b) => b.name)

  // create a unstyled paragraph element because it has base font size
  var p = document.createElement('p')
  document.body.append(p)

  const fontSize = parseFloat(window.getComputedStyle(p).getPropertyValue('font-size'))
  const widthEms = p.offsetWidth / fontSize

  p.remove()

  // Find the first breakpoint that this width is less than
  const breakpoint =
    breakpoints.find((bp) => widthEms < bp.ems) || breakpoints[breakpoints.length - 1]
  document.body.classList.add(breakpoint.name)
  names.forEach((name) => {
    if (name != breakpoint.name) document.body.classList.remove(name)
  })
}
