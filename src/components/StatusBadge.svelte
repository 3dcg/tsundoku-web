<script>
  import { STATUS_LABEL } from "../lib/constants.js";
  let { status } = $props();
</script>

<span class="status-badge s-{status}">{STATUS_LABEL[status]}</span>
