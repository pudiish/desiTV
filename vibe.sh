#!/usr/bin/env bash
# 🎵 DesiTV Vibe Loader - Because startups should be fun!
# Run this for good vibes while your servers spin up
# 🌌 NOW WITH TRIPPY GALAXY WARP EFFECTS! 🚀

set -euo pipefail

# Colors for the vibes ✨
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
WHITE='\033[1;37m'
RESET='\033[0m'
BOLD='\033[1m'

# Extended colors for trippy effects
BRIGHT_RED='\033[1;31m'
BRIGHT_GREEN='\033[1;32m'
BRIGHT_YELLOW='\033[1;33m'
BRIGHT_BLUE='\033[1;34m'
BRIGHT_MAGENTA='\033[1;35m'
BRIGHT_CYAN='\033[1;36m'
DIM='\033[2m'
BLINK='\033[5m'
REVERSE='\033[7m'

# Terminal dimensions
COLS=$(tput cols 2>/dev/null || echo 80)
ROWS=$(tput lines 2>/dev/null || echo 24)

# Hide cursor for smooth animations
tput civis 2>/dev/null || true
trap 'tput cnorm 2>/dev/null || true; clear; exit' INT TERM EXIT

# Clear screen
clear

# Star characters for galaxy effect
STARS=("." "·" "+" "✦" "✧" "★" "☆" "✶" "✷" "✸" "✹" "✺" "⋆" "✫" "✬" "✭" "✮" "✯" "✰" "⭐" "🌟" "💫" "✨")
WARP_CHARS=("─" "━" "═" "—" "―" "⎯" "─" "──" "───" "────" "─────")

# Starfield state - positions and speeds
declare -a STAR_X
declare -a STAR_Y
declare -a STAR_SPEED
declare -a STAR_CHAR
NUM_STARS=60

# Initialize starfield
init_starfield() {
  for ((i=0; i<NUM_STARS; i++)); do
    STAR_X[$i]=$((RANDOM % COLS))
    STAR_Y[$i]=$((RANDOM % ROWS))
    STAR_SPEED[$i]=$((RANDOM % 3 + 1))
    STAR_CHAR[$i]="${STARS[$((RANDOM % ${#STARS[@]}))]}"
  done
}

# Epic ASCII Art Banner
show_banner() {
  echo -e "${MAGENTA}"
  cat << 'EOF'
    ____            _ _______     __
   |  _ \  ___  ___(_)_   _\ \   / /
   | | | |/ _ \/ __| | | |  \ \ / / 
   | |_| |  __/\__ \ | | |   \ V /  
   |____/ \___||___/_| |_|    \_/   
                                    
   🎬 Your Indian Entertainment Hub 🇮🇳
EOF
  echo -e "${RESET}"
}

# 🌌 GALAXY WARP EFFECT - Stars rushing through space!
draw_galaxy() {
  local mode=$1  # "hold" "rush" "pulse"
  local intensity=$2
  local colors=("$DIM$WHITE" "$WHITE" "$BRIGHT_CYAN" "$BRIGHT_BLUE" "$BRIGHT_MAGENTA" "$YELLOW" "$BRIGHT_WHITE")
  
  # Draw stars at their positions
  for ((i=0; i<NUM_STARS; i++)); do
    local x=${STAR_X[$i]}
    local y=${STAR_Y[$i]}
    local speed=${STAR_SPEED[$i]}
    
    if [ "$mode" == "rush" ]; then
      # WARP SPEED! Stars become streaks
      local streak_len=$((speed * intensity))
      local color_idx=$((RANDOM % ${#colors[@]}))
      tput cup $y $x 2>/dev/null
      printf "${colors[$color_idx]}"
      for ((s=0; s<streak_len && x+s<COLS; s++)); do
        printf "━"
      done
      printf "${RESET}"
      
      # Move stars faster during rush
      STAR_X[$i]=$((x + speed * 3))
      if [ ${STAR_X[$i]} -ge $COLS ]; then
        STAR_X[$i]=0
        STAR_Y[$i]=$((RANDOM % ROWS))
        STAR_SPEED[$i]=$((RANDOM % 3 + 1))
      fi
      
    elif [ "$mode" == "hold" ]; then
      # HOLD - Stars twinkle in place, trippy colors
      local twinkle_chars=("✦" "✧" "★" "☆" "✶" "✷" "⭐" "🌟" "💫" "✨" " " " ")
      local char="${twinkle_chars[$((RANDOM % ${#twinkle_chars[@]}))]}"
      local color_idx=$((RANDOM % ${#colors[@]}))
      tput cup $y $x 2>/dev/null
      printf "${colors[$color_idx]}${char}${RESET}"
      
    elif [ "$mode" == "pulse" ]; then
      # PULSE - Stars breathe with intensity
      local pulse_chars=("·" "." "✦" "✧" "★" "✶" "✷" "✹" "✺" "⭐" "🌟")
      local char_idx=$((intensity % ${#pulse_chars[@]}))
      local color_idx=$((intensity % ${#colors[@]}))
      tput cup $y $x 2>/dev/null
      printf "${colors[$color_idx]}${pulse_chars[$char_idx]}${RESET}"
    fi
  done
}

# Hyperdrive warp tunnel effect
warp_tunnel() {
  local frame=$1
  local center_y=$((ROWS / 2))
  local center_x=$((COLS / 2))
  local tunnel_chars=("░" "▒" "▓" "█" "▓" "▒" "░")
  local colors=("$BLUE" "$CYAN" "$WHITE" "$BRIGHT_CYAN" "$MAGENTA" "$BRIGHT_MAGENTA")
  
  for ((ring=1; ring<=8; ring++)); do
    local radius=$((ring * 2 + frame % 3))
    local char_idx=$((ring % ${#tunnel_chars[@]}))
    local color_idx=$(( (ring + frame) % ${#colors[@]}))
    
    # Draw tunnel ring points
    for angle in 0 45 90 135 180 225 270 315; do
      local rad_angle=$(echo "scale=4; $angle * 3.14159 / 180" | bc 2>/dev/null || echo "0")
      local px=$((center_x + radius * 2))
      local py=$((center_y + radius / 2))
      
      if [ $py -ge 0 ] && [ $py -lt $ROWS ] && [ $px -ge 0 ] && [ $px -lt $COLS ]; then
        tput cup $py $px 2>/dev/null
        printf "${colors[$color_idx]}${tunnel_chars[$char_idx]}${RESET}"
      fi
    done
  done
}

# Trippy spiral galaxy
spiral_galaxy() {
  local frame=$1
  local center_y=$((ROWS / 2))
  local center_x=$((COLS / 2))
  local spiral_chars=("·" "✦" "★" "✶" "⭐" "🌟" "💫" "✨" "🔮" "💜" "💙" "💚" "💛")
  local colors=("$MAGENTA" "$BLUE" "$CYAN" "$GREEN" "$YELLOW" "$RED" "$BRIGHT_MAGENTA")
  
  for ((arm=0; arm<5; arm++)); do
    for ((point=0; point<12; point++)); do
      local angle=$(( (arm * 72 + point * 15 + frame * 5) % 360 ))
      local radius=$((point + 2))
      
      # Simple spiral calculation
      local offset_x=$(( (radius * (100 - angle % 100) / 50) - radius ))
      local offset_y=$(( (radius * (angle % 100) / 100) - radius / 2 ))
      
      local px=$((center_x + offset_x + (frame % 5) - 2))
      local py=$((center_y + offset_y / 2))
      
      if [ $py -ge 0 ] && [ $py -lt $ROWS ] && [ $px -ge 0 ] && [ $px -lt $COLS ]; then
        local char_idx=$(( (point + frame) % ${#spiral_chars[@]}))
        local color_idx=$(( (arm + frame / 3) % ${#colors[@]}))
        tput cup $py $px 2>/dev/null
        printf "${colors[$color_idx]}${spiral_chars[$char_idx]}${RESET}"
      fi
    done
  done
}

# Animated equalizer bars 🎵
equalizer() {
  local bars=("▁" "▂" "▃" "▄" "▅" "▆" "▇" "█")
  local colors=("$RED" "$YELLOW" "$GREEN" "$CYAN" "$BLUE" "$MAGENTA")
  local width=30
  
  printf "\r  🎵 "
  for ((i=0; i<width; i++)); do
    local bar_idx=$((RANDOM % ${#bars[@]}))
    local color_idx=$((i % ${#colors[@]}))
    printf "${colors[$color_idx]}${bars[$bar_idx]}${RESET}"
  done
  printf " 🎵"
}

# Spinning loader with style
spinner() {
  local frames=("⠋" "⠙" "⠹" "⠸" "⠼" "⠴" "⠦" "⠧" "⠇" "⠏")
  local colors=("$CYAN" "$MAGENTA" "$YELLOW" "$GREEN" "$BLUE" "$RED")
  local idx=$1
  local color_idx=$((idx % ${#colors[@]}))
  local frame_idx=$((idx % ${#frames[@]}))
  echo -e "${colors[$color_idx]}${frames[$frame_idx]}${RESET}"
}

# Dancing dots animation
dancing_dots() {
  local dots=("   " ".  " ".. " "..." " .." "  ." "   ")
  local idx=$((RANDOM % ${#dots[@]}))
  echo "${dots[$idx]}"
}

# Wave animation
wave() {
  local wave_chars=("🌊" "💫" "✨" "🔥" "💜" "💙" "💚" "💛" "🧡" "❤️")
  local width=20
  local offset=$1
  
  printf "\r  "
  for ((i=0; i<width; i++)); do
    local idx=$(( (i + offset) % ${#wave_chars[@]} ))
    printf "${wave_chars[$idx]} "
  done
}

# Progress bar with fire 🔥
fire_progress() {
  local progress=$1
  local width=40
  local filled=$((progress * width / 100))
  local empty=$((width - filled))
  
  printf "\r  ${YELLOW}["
  for ((i=0; i<filled; i++)); do
    printf "${RED}█"
  done
  for ((i=0; i<empty; i++)); do
    printf "${WHITE}░"
  done
  printf "${YELLOW}]${RESET} ${GREEN}${progress}%%${RESET} 🔥"
}

# Fun loading messages
loading_messages=(
  "🎬 Warming up Bollywood vibes..."
  "📺 Tuning into desi channels..."
  "🎵 Loading the beats..."
  "🌟 Polishing the stars..."
  "🎭 Setting the stage..."
  "🎪 Preparing the show..."
  "🍿 Popping the popcorn..."
  "🎸 Strumming the guitars..."
  "💃 Getting ready to dance..."
  "🎤 Mic check, one two..."
  "🎥 Rolling cameras..."
  "✨ Sprinkling magic..."
  "🚀 Launching entertainment..."
  "🌈 Painting the screen..."
  "🎊 Party mode activating..."
)

# Main vibe loop
main_vibe() {
  show_banner
  
  echo -e "\n${CYAN}${BOLD}  Starting DesiTV Experience...${RESET}\n"
  sleep 0.5
  
  local counter=0
  local progress=0
  local msg_idx=0
  
  while [ $progress -le 100 ]; do
    # Equalizer animation
    equalizer
    echo ""
    
    # Wave animation
    wave $counter
    echo ""
    
    # Progress bar
    fire_progress $progress
    echo ""
    
    # Loading message with spinner
    local spin=$(spinner $counter)
    local current_msg="${loading_messages[$msg_idx]}"
    printf "\r  ${spin} ${WHITE}${current_msg}${RESET}          "
    
    # Move cursor back up for next frame
    tput cuu 3 2>/dev/null || printf "\033[3A"
    
    # Update counters
    counter=$((counter + 1))
    progress=$((progress + RANDOM % 5 + 1))
    if [ $progress -gt 100 ]; then progress=100; fi
    
    # Change message every few iterations
    if [ $((counter % 8)) -eq 0 ]; then
      msg_idx=$(( (msg_idx + 1) % ${#loading_messages[@]} ))
    fi
    
    sleep 0.08
  done
  
  # Final state
  tput cud 4 2>/dev/null || printf "\033[4B"
  echo ""
  echo ""
  
  # Celebration animation
  echo -e "\n${GREEN}${BOLD}  ✅ DesiTV is ready to rock! 🎉${RESET}\n"
  
  # Fun celebration loop
  for ((i=0; i<3; i++)); do
    echo -ne "\r  🎉 🎊 🎬 🌟 ✨ 💫 🔥 💜 🎵 🎸 "
    sleep 0.2
    echo -ne "\r  💫 🔥 💜 🎵 🎸 🎉 🎊 🎬 🌟 ✨ "
    sleep 0.2
  done
  
  echo -e "\n\n${CYAN}  ╔════════════════════════════════════════╗${RESET}"
  echo -e "${CYAN}  ║${RESET}  ${YELLOW}🚀 Server:${RESET} http://localhost:5001      ${CYAN}║${RESET}"
  echo -e "${CYAN}  ║${RESET}  ${MAGENTA}🌐 Client:${RESET} http://localhost:5173      ${CYAN}║${RESET}"
  echo -e "${CYAN}  ╚════════════════════════════════════════╝${RESET}\n"
  
  echo -e "  ${WHITE}Press ${GREEN}Ctrl+C${WHITE} to stop the vibes 🛑${RESET}\n"
}

# Infinite ambient mode after startup
ambient_mode() {
  echo -e "\n${MAGENTA}${BOLD}  🎵 Ambient Vibe Mode Active 🎵${RESET}\n"
  
  local counter=0
  while true; do
    # Peaceful equalizer
    equalizer
    
    # Cycle through chill messages
    local chill_msgs=(
      "🎬 Streaming happiness..."
      "📺 Entertainment flowing..."
      "🌟 Stars shining bright..."
      "💜 Vibes on point..."
      "🎵 Music never stops..."
    )
    local msg_idx=$((counter % ${#chill_msgs[@]}))
    printf "  ${WHITE}${chill_msgs[$msg_idx]}${RESET}     "
    
    printf "\r"
    
    counter=$((counter + 1))
    sleep 0.15
  done
}

# 🌌 TRIPPY GALAXY MODE - The main event!
trippy_galaxy_mode() {
  init_starfield
  clear
  
  local frame=0
  local mode="hold"
  local mode_duration=0
  local rush_intensity=1
  local beat_counter=0
  
  # Trippy mode messages
  local trippy_msgs=(
    "🌌 Entering the cosmos..."
    "🚀 WARP SPEED ENGAGED!"
    "✨ Stars aligning..."
    "💫 Through the nebula..."
    "🔮 Reality bending..."
    "🌠 Shooting stars!"
    "💜 Purple haze..."
    "🌊 Cosmic waves..."
    "⚡ Energy surge!"
    "🎆 Supernova blast!"
  )
  
  while true; do
    # Clear for fresh frame
    clear
    
    # Mode switching logic - creates the hold and rush effect
    mode_duration=$((mode_duration + 1))
    
    if [ "$mode" == "hold" ] && [ $mode_duration -gt 30 ]; then
      mode="rush"
      mode_duration=0
      rush_intensity=1
    elif [ "$mode" == "rush" ] && [ $mode_duration -gt 20 ]; then
      mode="pulse"
      mode_duration=0
    elif [ "$mode" == "pulse" ] && [ $mode_duration -gt 25 ]; then
      mode="hold"
      mode_duration=0
    fi
    
    # Increase rush intensity during rush mode
    if [ "$mode" == "rush" ]; then
      rush_intensity=$((rush_intensity + 1))
      if [ $rush_intensity -gt 5 ]; then rush_intensity=5; fi
    fi
    
    # Draw the galaxy based on current mode
    draw_galaxy "$mode" $rush_intensity
    
    # Add spiral galaxy overlay during pulse
    if [ "$mode" == "pulse" ]; then
      spiral_galaxy $frame
    fi
    
    # Draw center content
    local center_y=$((ROWS / 2 - 4))
    
    # Show mode indicator with trippy styling
    tput cup $center_y $((COLS/2 - 15)) 2>/dev/null
    case $mode in
      "hold")
        printf "${DIM}${CYAN}━━━━ ${BRIGHT_CYAN}✨ HOLD ✨${CYAN} ━━━━${RESET}"
        ;;
      "rush")
        printf "${BOLD}${MAGENTA}▶▶▶▶ ${BRIGHT_MAGENTA}🚀 WARP! 🚀${MAGENTA} ▶▶▶▶${RESET}"
        ;;
      "pulse")
        printf "${YELLOW}◆◇◆◇ ${BRIGHT_YELLOW}💫 PULSE 💫${YELLOW} ◇◆◇◆${RESET}"
        ;;
    esac
    
    # Animated message
    local msg_idx=$(( (frame / 15) % ${#trippy_msgs[@]}))
    tput cup $((center_y + 2)) $((COLS/2 - 15)) 2>/dev/null
    printf "${WHITE}${trippy_msgs[$msg_idx]}${RESET}                    "
    
    # Equalizer at bottom
    tput cup $((ROWS - 3)) 2 2>/dev/null
    equalizer
    
    # Beat counter visualization
    beat_counter=$(( (beat_counter + 1) % 8 ))
    local beat_visual=""
    for ((b=0; b<8; b++)); do
      if [ $b -eq $beat_counter ]; then
        beat_visual+="${BRIGHT_MAGENTA}●${RESET}"
      else
        beat_visual+="${DIM}○${RESET}"
      fi
    done
    tput cup $((ROWS - 2)) $((COLS/2 - 4)) 2>/dev/null
    printf "$beat_visual"
    
    # Frame counter
    frame=$((frame + 1))
    
    # Speed based on mode
    case $mode in
      "hold") sleep 0.12 ;;
      "rush") sleep 0.04 ;;
      "pulse") sleep 0.08 ;;
    esac
  done
}

# Run the vibes!
main_vibe

# Enter trippy galaxy mode (infinite loop with hold/rush effects)
trippy_galaxy_mode
